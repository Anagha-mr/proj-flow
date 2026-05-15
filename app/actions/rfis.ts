"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface RFI {
  id: string
  studio_id: string
  project_id: string
  contractor_id: string | null
  ref_number: string
  raised_by_type: 'contractor' | 'designer'
  raised_by_id: string
  title: string
  description: string
  linked_document_id: string | null
  space_tag: string | null
  status: 'open' | 'under_review' | 'responded' | 'closed'
  response_deadline: string
  response_text: string | null
  responded_by_id: string | null
  responded_at: string | null
  escalated_at: string | null
  created_at: string
  updated_at: string
  contractor?: { company_name: string; contact_name: string }
  linked_document?: { name: string }
  responder?: { name: string }
}

async function generateRfiRefNumber(
  projectId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single()

  const rawName = project?.name ?? "PROJ"
  const projectCode = rawName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X")

  const { count } = await supabase
    .from("rfis")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)

  const seq = String((count ?? 0) + 1).padStart(3, "0")
  return `RFI-${projectCode}-${seq}`
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review", "closed"],
  under_review: ["responded"],
  responded: ["closed"],
  closed: [],
}

export async function getRfis(projectId: string): Promise<RFI[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: rfis, error } = await supabase
    .from("rfis")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!rfis || rfis.length === 0) return []

  const contractorIds = [...new Set(rfis.filter((r) => r.contractor_id).map((r) => r.contractor_id as string))]
  const documentIds = [...new Set(rfis.filter((r) => r.linked_document_id).map((r) => r.linked_document_id as string))]
  const responderIds = [...new Set(rfis.filter((r) => r.responded_by_id).map((r) => r.responded_by_id as string))]

  const [contractorData, documentData, responderData] = await Promise.all([
    contractorIds.length > 0
      ? supabase.from("contractors").select("id, company_name, contact_name").in("id", contractorIds)
      : { data: [] },
    documentIds.length > 0
      ? supabase.from("documents").select("id, name").in("id", documentIds)
      : { data: [] },
    responderIds.length > 0
      ? supabase.from("users").select("id, name").in("id", responderIds)
      : { data: [] },
  ])

  const contractorMap = Object.fromEntries(
    (contractorData.data ?? []).map((c) => [c.id, { company_name: c.company_name, contact_name: c.contact_name }])
  )
  const documentMap = Object.fromEntries(
    (documentData.data ?? []).map((d) => [d.id, { name: d.name }])
  )
  const responderMap = Object.fromEntries(
    (responderData.data ?? []).map((u) => [u.id, { name: u.name }])
  )

  return rfis.map((r) => ({
    ...(r as unknown as RFI),
    contractor: r.contractor_id ? contractorMap[r.contractor_id] : undefined,
    linked_document: r.linked_document_id ? documentMap[r.linked_document_id] : undefined,
    responder: r.responded_by_id ? responderMap[r.responded_by_id] : undefined,
  }))
}

export async function createRfi(input: {
  projectId: string
  title: string
  description: string
  contractorId?: string
  linkedDocumentId?: string
  spaceTag?: string
  raisedByType?: 'contractor' | 'designer'
  responseDeadlineHours?: number
}): Promise<RFI> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const refNumber = await generateRfiRefNumber(input.projectId, supabase)
  const deadlineHours = input.responseDeadlineHours ?? 48
  const responseDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("rfis")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      contractor_id: input.contractorId ?? null,
      ref_number: refNumber,
      raised_by_type: input.raisedByType ?? 'designer',
      raised_by_id: userId,
      title: input.title,
      description: input.description,
      linked_document_id: input.linkedDocumentId ?? null,
      space_tag: input.spaceTag ?? null,
      status: 'open',
      response_deadline: responseDeadline,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  try {
    const { notifyRfiReceived } = await import("./notifications")
    notifyRfiReceived(data.id).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as unknown as RFI
}

export async function respondToRfi(rfiId: string, responseText: string): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")
  if (rfi.status === 'responded' || rfi.status === 'closed') {
    throw new Error("RFI is already responded or closed")
  }

  await supabase
    .from("rfis")
    .update({
      response_text: responseText,
      responded_by_id: userId,
      responded_at: new Date().toISOString(),
      status: 'responded',
    })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  try {
    const { notifyRfiResponded } = await import("./notifications")
    notifyRfiResponded(rfiId).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function updateRfiStatus(rfiId: string, status: RFI['status']): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")

  const allowed = VALID_TRANSITIONS[rfi.status] ?? []
  if (!allowed.includes(status)) throw new Error("Invalid status transition")

  await supabase
    .from("rfis")
    .update({ status })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function deleteRfi(rfiId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")
  if (rfi.status !== 'open') throw new Error("Only open RFIs can be deleted")

  await supabase.from("rfis").delete().eq("id", rfiId).eq("studio_id", studioId)
  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function checkAndEscalateRfis(projectId: string): Promise<number> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfis } = await supabase
    .from("rfis")
    .select("id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .in("status", ["open", "under_review"])
    .lt("response_deadline", new Date().toISOString())
    .is("escalated_at", null)

  if (!rfis || rfis.length === 0) return 0

  const now = new Date().toISOString()
  const ids = rfis.map((r) => r.id)

  await supabase
    .from("rfis")
    .update({ escalated_at: now })
    .in("id", ids)
    .eq("studio_id", studioId)

  for (const rfi of rfis) {
    try {
      const { notifyRfiEscalated } = await import("./notifications")
      notifyRfiEscalated(rfi.id).catch(() => {})
    } catch {
      // fire-and-forget
    }
  }

  return rfis.length
}
