"use server"

import { getAuthContext } from "./_auth"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface SiteUpdate {
  id: string
  studio_id: string
  project_id: string
  submitted_by_type: 'contractor' | 'designer'
  submitted_by_id: string
  photos: string[]
  space_tag: string | null
  phase_tag: 'before' | 'during' | 'after' | null
  status_note: string | null
  is_client_visible: boolean
  submitted_at: string
  created_at: string
  updated_at: string
  submitter?: { name: string }
}

export async function getSiteUpdates(projectId: string): Promise<SiteUpdate[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: updates, error } = await supabase
    .from("site_updates")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("submitted_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!updates || updates.length === 0) return []

  // Fetch submitter names in a separate query — only for designer type (users table)
  const designerIds = updates
    .filter((u) => u.submitted_by_type === "designer")
    .map((u) => u.submitted_by_id)
  const uniqueDesignerIds = [...new Set(designerIds)]

  const submitterMap: Record<string, string> = {}
  if (uniqueDesignerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", uniqueDesignerIds)
    ;(users ?? []).forEach((u) => { submitterMap[u.id] = u.name })
  }

  return updates.map((u) => ({
    ...(u as unknown as SiteUpdate),
    submitter: submitterMap[u.submitted_by_id]
      ? { name: submitterMap[u.submitted_by_id] }
      : undefined,
  }))
}

export async function createSiteUpdate(input: {
  projectId: string
  photos: string[]
  spaceTag?: string
  phaseTag?: 'before' | 'during' | 'after'
  statusNote?: string
  isClientVisible?: boolean
}): Promise<SiteUpdate> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: newUpdate, error } = await supabase
    .from("site_updates")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      submitted_by_type: "designer",
      submitted_by_id: userId,
      photos: input.photos,
      space_tag: input.spaceTag ?? null,
      phase_tag: input.phaseTag ?? null,
      status_note: input.statusNote ?? null,
      is_client_visible: input.isClientVisible ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('INSERT ERROR:', error)
    throw new Error(error.message)
  }

  if (input.isClientVisible) {
    try {
      const { notifySiteUpdatePosted } = await import("./notifications")
      notifySiteUpdatePosted(input.projectId, newUpdate.id).catch(() => {})
    } catch {
      // fire-and-forget — never surface
    }
  }

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return newUpdate as unknown as SiteUpdate
}

export async function toggleClientVisible(updateId: string, value: boolean): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: update } = await supabase
    .from("site_updates")
    .select("project_id, studio_id")
    .eq("id", updateId)
    .single()
  if (!update || update.studio_id !== studioId) throw new Error("Not found")

  await supabase
    .from("site_updates")
    .update({ is_client_visible: value })
    .eq("id", updateId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${update.project_id}`)
}

export async function deleteSiteUpdate(updateId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: update } = await supabase
    .from("site_updates")
    .select("project_id, studio_id")
    .eq("id", updateId)
    .single()
  if (!update || update.studio_id !== studioId) throw new Error("Not found")

  await supabase
    .from("site_updates")
    .delete()
    .eq("id", updateId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${update.project_id}`)
}

export async function getSiteUpdatesPublic(
  portalToken: string,
  projectId: string
): Promise<SiteUpdate[]> {
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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("client_id", client.id)
    .single()

  if (!project) throw new Error("Invalid portal access")

  const { data: updates } = await supabase
    .from("site_updates")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_client_visible", true)
    .order("submitted_at", { ascending: false })

  return (updates ?? []) as unknown as SiteUpdate[]
}
