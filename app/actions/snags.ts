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
  plan_reference: string | null
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

  const [designerData, contractorData] = await Promise.all([
    designerIds.length > 0
      ? supabase.from("users").select("id, name").in("id", designerIds)
      : { data: [] },
    contractorIds.length > 0
      ? supabase.from("contractors").select("id, company_name").in("id", contractorIds)
      : { data: [] },
  ])

  const nameMap: Record<string, string> = {}
  ;(designerData.data ?? []).forEach((u) => { nameMap[u.id] = u.name })
  ;(contractorData.data ?? []).forEach((c) => { nameMap[c.id] = c.company_name })

  return snags.map((s) => ({
    ...(s as unknown as SnagItem),
    assignee_name: nameMap[s.assigned_to_id] ?? undefined,
  }))
}

export async function createSnagItem(input: {
  projectId: string
  photoUrl: string
  locationDescription: string
  planReference?: string
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
      plan_reference: input.planReference ?? null,
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
  return data as unknown as SnagItem
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
