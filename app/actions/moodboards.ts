"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Moodboard {
  id: string
  studio_id: string
  project_id: string
  title: string
  description: string | null
  canva_design_id: string | null
  canva_embed_url: string | null
  canva_edit_url: string | null
  canva_export_url: string | null
  thumbnail_url: string | null
  status: 'draft' | 'shared_with_client' | 'approved' | 'archived'
  share_token: string
  is_client_visible: boolean
  client_feedback: string | null
  client_approved_at: string | null
  client_approved_by: string | null
  display_order: number
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export type CreateMoodboardInput = {
  project_id: string
  title: string
  description?: string
  canva_design_id?: string
  canva_embed_url?: string
  canva_edit_url?: string
  thumbnail_url?: string
}

export type UpdateMoodboardInput = Partial<Pick<
  Moodboard,
  'title' | 'description' | 'canva_design_id' | 'canva_embed_url' |
  'canva_edit_url' | 'canva_export_url' | 'thumbnail_url' |
  'status' | 'is_client_visible' | 'client_feedback'
>>

// ─── getMoodboards ────────────────────────────────────────────────────────────

export async function getMoodboards(projectId: string): Promise<Moodboard[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("moodboards")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Moodboard[]
}

// ─── createMoodboard ──────────────────────────────────────────────────────────

export async function createMoodboard(input: CreateMoodboardInput): Promise<Moodboard> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase.from as any)("moodboards")
    .select("display_order")
    .eq("project_id", input.project_id)
    .order("display_order", { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxRow?.display_order ?? -1) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("moodboards")
    .insert({
      studio_id: studioId,
      project_id: input.project_id,
      title: input.title,
      description: input.description ?? null,
      canva_design_id: input.canva_design_id ?? null,
      canva_embed_url: input.canva_embed_url ?? null,
      canva_edit_url: input.canva_edit_url ?? null,
      thumbnail_url: input.thumbnail_url ?? null,
      display_order: nextOrder,
      created_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${input.project_id}`)
  return data as Moodboard
}

// ─── updateMoodboard ──────────────────────────────────────────────────────────

export async function updateMoodboard(
  moodboardId: string,
  updates: UpdateMoodboardInput
): Promise<Moodboard> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)("moodboards")
    .select("studio_id, project_id, status, is_client_visible")
    .eq("id", moodboardId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error("Not found")

  const merged = { ...updates }

  if (updates.is_client_visible === true && existing.status === 'draft') {
    merged.status = 'shared_with_client'
  } else if (updates.is_client_visible === false && existing.status === 'shared_with_client') {
    merged.status = 'draft'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("moodboards")
    .update(merged)
    .eq("id", moodboardId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${existing.project_id}`)
  return data as Moodboard
}

// ─── deleteMoodboard ──────────────────────────────────────────────────────────

export async function deleteMoodboard(moodboardId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)("moodboards")
    .select("studio_id, project_id, status")
    .eq("id", moodboardId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error("Not found")

  if (!['draft', 'archived'].includes(existing.status)) {
    throw new Error("Cannot delete a moodboard that has been shared with or approved by the client")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("moodboards")
    .delete()
    .eq("id", moodboardId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${existing.project_id}`)
}

// ─── reorderMoodboards ────────────────────────────────────────────────────────

export async function reorderMoodboards(
  projectId: string,
  orderedIds: string[]
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  try {
    for (let i = 0; i < orderedIds.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)("moodboards")
        .update({ display_order: i })
        .eq("id", orderedIds[i])
        .eq("project_id", projectId)
    }
  } catch {
    throw new Error("Failed to reorder moodboards")
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
}

// ─── shareMoodboardWithClient ─────────────────────────────────────────────────

export async function shareMoodboardWithClient(moodboardId: string): Promise<Moodboard> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)("moodboards")
    .select("studio_id, project_id, title, share_token")
    .eq("id", moodboardId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error("Not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("moodboards")
    .update({ is_client_visible: true, status: 'shared_with_client' })
    .eq("id", moodboardId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/moodboard/${existing.share_token}`
  const { notifyClientMoodboardShared } = await import("./notifications")
  notifyClientMoodboardShared(studioId, existing.project_id, existing.title, shareUrl).catch(() => {})

  revalidatePath(`/dashboard/projects/${existing.project_id}`)
  return data as Moodboard
}

// ─── clientApproveMoodboard ───────────────────────────────────────────────────

export async function clientApproveMoodboard(
  shareToken: string,
  approvedByName: string,
  feedback?: string
): Promise<void> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: moodboard } = await (supabase.from as any)("moodboards")
    .select("id, studio_id, project_id, title, is_client_visible")
    .eq("share_token", shareToken)
    .single()

  if (!moodboard) throw new Error("Moodboard not found")
  if (!moodboard.is_client_visible) throw new Error("This moodboard is not available for review")

  const updates: Record<string, unknown> = {
    status: 'approved',
    client_approved_at: new Date().toISOString(),
    client_approved_by: approvedByName,
  }
  if (feedback) updates.client_feedback = feedback

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("moodboards")
    .update(updates)
    .eq("id", moodboard.id)

  if (error) throw new Error(error.message)

  const { notifyMoodboardApproved } = await import("./notifications")
  notifyMoodboardApproved(
    moodboard.studio_id,
    moodboard.project_id,
    moodboard.title,
    approvedByName
  ).catch(() => {})
}

// ─── clientRequestRevision ────────────────────────────────────────────────────

export async function clientRequestRevision(
  shareToken: string,
  feedback: string,
  requestedByName: string
): Promise<void> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: moodboard } = await (supabase.from as any)("moodboards")
    .select("id, studio_id, project_id, title, is_client_visible")
    .eq("share_token", shareToken)
    .single()

  if (!moodboard) throw new Error("Moodboard not found")
  if (!moodboard.is_client_visible) throw new Error("This moodboard is not available for review")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("moodboards")
    .update({
      status: 'draft',
      client_feedback: feedback,
      is_client_visible: false,
    })
    .eq("id", moodboard.id)

  if (error) throw new Error(error.message)

  const { notifyMoodboardRevisionRequested } = await import("./notifications")
  notifyMoodboardRevisionRequested(
    moodboard.studio_id,
    moodboard.project_id,
    moodboard.title,
    feedback
  ).catch(() => {})
}

// ─── getMoodboardByShareToken ─────────────────────────────────────────────────

export async function getMoodboardByShareToken(shareToken: string): Promise<Moodboard | null> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)("moodboards")
    .select("*")
    .eq("share_token", shareToken)
    .single()

  if (!data) return null
  if (!data.is_client_visible) return null

  return data as Moodboard
}
