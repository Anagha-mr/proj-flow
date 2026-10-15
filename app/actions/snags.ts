"use server"

import { getAuthContext } from "./_auth"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface SnagItem {
  id: string
  studio_id: string
  project_id: string
  photo_url: string
  location_description: string
  /** @deprecated legacy free-text plan reference, kept for pre-Sprint-26 rows. Prefer plan_reference_document_id. */
  plan_reference: string | null
  plan_reference_document_id: string | null
  description: string
  assigned_to_type: 'contractor' | 'vendor' | 'designer'
  assigned_to_id: string
  due_date: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'client_signed_off'
  resolution_photo_url: string | null
  resolution_note: string | null
  client_signed_off_at: string | null
  client_signed_off_by: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
  assignee_name?: string
  /** Resolved "filename — v{version}" for plan_reference_document_id, falling back to the legacy plan_reference text. Null if neither is set. */
  plan_reference_display?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// plan_reference_document_id is a Postgres UUID FK — a legacy free-text value
// (e.g. "ANA" from the pre-Sprint-26 text input, or anything else client-
// controlled) must never be passed through raw, or Postgres throws
// "invalid input syntax for type uuid". Coerce anything that isn't a real
// UUID to null rather than erroring — an unresolvable reference is treated
// the same as "no reference selected".
function normalizeDocumentId(value: string | null | undefined): string | null {
  if (!value) return null
  return UUID_RE.test(value) ? value : null
}

export async function getSnagItems(projectId: string): Promise<SnagItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: snags, error } = await supabase
    .from("snag_items")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!snags || snags.length === 0) return []

  const designerIds = [...new Set(
    snags.filter((s) => s.assigned_to_type === 'designer').map((s) => s.assigned_to_id)
  )]
  const contractorIds = [...new Set(
    snags.filter((s) => s.assigned_to_type === 'contractor').map((s) => s.assigned_to_id)
  )]

  const planDocIds = [...new Set(
    snags.map((s) => (s as unknown as SnagItem).plan_reference_document_id).filter(Boolean)
  )] as string[]

  const [designerData, contractorData, planDocData] = await Promise.all([
    designerIds.length > 0
      ? supabase.from("users").select("id, name").in("id", designerIds)
      : { data: [] },
    contractorIds.length > 0
      ? supabase.from("contractors").select("id, company_name").in("id", contractorIds)
      : { data: [] },
    planDocIds.length > 0
      ? supabase.from("documents").select("id, name, version_number").in("id", planDocIds)
      : { data: [] },
  ])

  const nameMap: Record<string, string> = {}
  ;(designerData.data ?? []).forEach((u) => { nameMap[u.id] = u.name })
  ;(contractorData.data ?? []).forEach((c) => { nameMap[c.id] = c.company_name })

  const planDocMap = new Map(
    (planDocData.data ?? []).map((d: { id: string; name: string; version_number: number }) => [d.id, `${d.name} — v${d.version_number}`])
  )

  return snags.map((s) => {
    const snag = s as unknown as SnagItem
    return {
      ...snag,
      assignee_name: nameMap[snag.assigned_to_id] ?? undefined,
      plan_reference_display: snag.plan_reference_document_id
        ? planDocMap.get(snag.plan_reference_document_id) ?? null
        : snag.plan_reference ?? null,
    }
  })
}

export async function createSnagItem(input: {
  projectId: string
  photoUrl: string
  locationDescription: string
  planReferenceDocumentId?: string | null
  description: string
  assignedToType: SnagItem['assigned_to_type']
  assignedToId: string
  dueDate?: string
}): Promise<SnagItem> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("snag_items")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      photo_url: input.photoUrl,
      location_description: input.locationDescription,
      // plan_reference (legacy free text) is intentionally left null going
      // forward — plan_reference_document_id is the structured replacement (Bug #29).
      plan_reference_document_id: normalizeDocumentId(input.planReferenceDocumentId),
      description: input.description,
      assigned_to_type: input.assignedToType,
      assigned_to_id: input.assignedToId,
      due_date: input.dueDate ?? null,
      created_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)

  const created = data as unknown as SnagItem
  return { ...created, plan_reference_display: await resolvePlanReferenceDisplay(supabase, created) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePlanReferenceDisplay(supabase: any, snag: SnagItem): Promise<string | null> {
  if (snag.plan_reference_document_id) {
    const { data: doc } = await supabase
      .from("documents")
      .select("name, version_number")
      .eq("id", snag.plan_reference_document_id)
      .single()
    return doc ? `${doc.name} — v${doc.version_number}` : null
  }
  return snag.plan_reference ?? null
}

export async function updateSnagItem(
  snagId: string,
  updates: {
    locationDescription?: string
    photoUrl?: string
    planReferenceDocumentId?: string | null
    description?: string
    assignedToType?: SnagItem['assigned_to_type']
    assignedToId?: string
    dueDate?: string | null
  }
): Promise<SnagItem> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("snag_items")
    .select("project_id, studio_id, status")
    .eq("id", snagId)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Snag item not found")
  if (existing.status === 'client_signed_off') throw new Error("Cannot edit a client signed-off item")

  const dbUpdates: {
    location_description?: string
    photo_url?: string
    plan_reference_document_id?: string | null
    description?: string
    assigned_to_type?: SnagItem['assigned_to_type']
    assigned_to_id?: string
    due_date?: string | null
  } = {}
  if (updates.locationDescription !== undefined) dbUpdates.location_description = updates.locationDescription
  if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl
  if (updates.planReferenceDocumentId !== undefined) {
    dbUpdates.plan_reference_document_id = normalizeDocumentId(updates.planReferenceDocumentId)
  }
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.assignedToType !== undefined) dbUpdates.assigned_to_type = updates.assignedToType
  if (updates.assignedToId !== undefined) dbUpdates.assigned_to_id = updates.assignedToId
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null

  if (Object.keys(dbUpdates).length === 0) {
    const { data: unchanged } = await supabase.from("snag_items").select("*").eq("id", snagId).single()
    const snag = unchanged as unknown as SnagItem
    return { ...snag, plan_reference_display: await resolvePlanReferenceDisplay(supabase, snag) }
  }

  const { data, error } = await supabase
    .from("snag_items")
    .update(dbUpdates)
    .eq("id", snagId)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${existing.project_id}`)

  const updated = data as unknown as SnagItem
  return { ...updated, plan_reference_display: await resolvePlanReferenceDisplay(supabase, updated) }
}

// ─── Bug #29: drawings dropdown for plan reference ──────────────────────────
// Small parallel version of spec.ts's getDrawingDocumentsForProject: that
// helper only selects id/name (no version_number), but the plan reference
// dropdown needs to display "filename — v{version_number}" per the convention
// established in Bug #28's Spec table and PDF export.
export async function getProjectDrawingDocuments(
  projectId: string
): Promise<Array<{ id: string; name: string; version_number: number }>> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, version_number")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .eq("category", "Drawings")
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ id: string; name: string; version_number: number }>
}

export async function resolveSnagItem(
  snagId: string,
  input: { resolutionPhotoUrl: string; resolutionNote: string }
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  if (!input.resolutionPhotoUrl || !input.resolutionNote) {
    throw new Error("Resolution requires both a photo and a note")
  }

  const { data: snag } = await supabase
    .from("snag_items")
    .select("project_id, studio_id, status")
    .eq("id", snagId)
    .single()
  if (!snag || snag.studio_id !== studioId) throw new Error("Snag item not found")
  if (snag.status === 'client_signed_off') throw new Error("Cannot update a client signed-off item")

  await supabase
    .from("snag_items")
    .update({
      resolution_photo_url: input.resolutionPhotoUrl,
      resolution_note: input.resolutionNote,
      status: 'resolved',
    })
    .eq("id", snagId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${snag.project_id}`)
}

export async function reopenSnagItem(snagId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: snag } = await supabase
    .from("snag_items")
    .select("project_id, studio_id, status")
    .eq("id", snagId)
    .single()
  if (!snag || snag.studio_id !== studioId) throw new Error("Snag item not found")
  if (snag.status !== 'resolved') throw new Error("Only resolved items can be reopened")

  await supabase
    .from("snag_items")
    .update({ status: 'open', resolution_photo_url: null, resolution_note: null })
    .eq("id", snagId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${snag.project_id}`)
}

export async function updateSnagStatus(
  snagId: string,
  status: 'open' | 'in_progress'
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: snag } = await supabase
    .from("snag_items")
    .select("project_id, studio_id, status")
    .eq("id", snagId)
    .single()
  if (!snag || snag.studio_id !== studioId) throw new Error("Snag item not found")
  if (snag.status === 'client_signed_off') throw new Error("Cannot update a client signed-off item")

  await supabase
    .from("snag_items")
    .update({ status })
    .eq("id", snagId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${snag.project_id}`)
}

export async function deleteSnagItem(snagId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: snag } = await supabase
    .from("snag_items")
    .select("project_id, studio_id, status")
    .eq("id", snagId)
    .single()
  if (!snag || snag.studio_id !== studioId) throw new Error("Snag item not found")
  if (snag.status !== 'open') throw new Error("Only open snag items can be deleted")

  await supabase.from("snag_items").delete().eq("id", snagId).eq("studio_id", studioId)
  revalidatePath(`/dashboard/projects/${snag.project_id}`)
}

export async function clientSignOffSnagItem(
  snagId: string,
  portalToken: string,
  clientName: string
): Promise<void> {
  const supabase = await createClient()

  const { data: client } = await supabase
    .from("clients")
    .select("id, portal_token_expires_at")
    .eq("portal_token", portalToken)
    .single()

  if (!client) throw new Error("Invalid portal access")
  if (client.portal_token_expires_at && new Date(client.portal_token_expires_at) < new Date()) {
    throw new Error("Invalid portal access")
  }

  const { data: snag } = await supabase
    .from("snag_items")
    .select("id, project_id, status")
    .eq("id", snagId)
    .single()
  if (!snag) throw new Error("Snag item not found")

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", snag.project_id)
    .eq("client_id", client.id)
    .single()
  if (!project) throw new Error("Invalid portal access")

  if (snag.status !== 'resolved') {
    throw new Error("Item must be resolved before client sign-off")
  }

  await supabase
    .from("snag_items")
    .update({
      status: 'client_signed_off',
      client_signed_off_at: new Date().toISOString(),
      client_signed_off_by: clientName,
    })
    .eq("id", snagId)

  revalidatePath(`/dashboard/projects/${snag.project_id}`)
}
