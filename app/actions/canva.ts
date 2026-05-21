"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanvaConnectionStatus {
  connected: boolean
  canva_user_id: string | null
  token_expires_at: string | null
  is_expired: boolean
}

export interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
  edit_url: string
  view_url: string
  created_at: string
  updated_at: string
}

// ─── getCanvaConnectionStatus ─────────────────────────────────────────────────

export async function getCanvaConnectionStatus(): Promise<CanvaConnectionStatus> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studio } = await (supabase.from as any)("studios")
    .select("canva_access_token, canva_token_expires_at, canva_user_id")
    .eq("id", studioId)
    .single()

  const connected = !!studio?.canva_access_token
  const expiresAt = studio?.canva_token_expires_at ?? null
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false

  return {
    connected,
    canva_user_id: studio?.canva_user_id ?? null,
    token_expires_at: expiresAt,
    is_expired: isExpired,
  }
}

// ─── disconnectCanva ──────────────────────────────────────────────────────────

export async function disconnectCanva(): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner") throw new Error("Only the studio owner can disconnect Canva")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("studios")
    .update({
      canva_access_token: null,
      canva_refresh_token: null,
      canva_token_expires_at: null,
      canva_user_id: null,
    })
    .eq("id", studioId)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/settings")
}

// ─── refreshCanvaTokenIfNeeded ────────────────────────────────────────────────

export async function refreshCanvaTokenIfNeeded(): Promise<string | null> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studio } = await (supabase.from as any)("studios")
    .select("canva_access_token, canva_refresh_token, canva_token_expires_at")
    .eq("id", studioId)
    .single()

  if (!studio?.canva_access_token) return null

  const expiresAt = studio.canva_token_expires_at
    ? new Date(studio.canva_token_expires_at)
    : null

  // Still valid if not expired or expires more than 5 minutes from now
  if (expiresAt && expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return studio.canva_access_token as string
  }

  if (!studio.canva_refresh_token) return null

  try {
    const res = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: studio.canva_refresh_token as string,
        client_id: process.env.CANVA_CLIENT_ID!,
        client_secret: process.env.CANVA_CLIENT_SECRET!,
      }),
    })

    if (!res.ok) throw new Error("Token refresh failed")

    const json = await res.json()
    const newAccessToken = json.access_token as string
    const expiresIn = (json.expires_in as number) ?? 3600
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)("studios").update({
      canva_access_token: newAccessToken,
      canva_token_expires_at: newExpiresAt,
    }).eq("id", studioId)

    return newAccessToken
  } catch {
    // Clear tokens — user needs to reconnect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)("studios").update({
      canva_access_token: null,
      canva_refresh_token: null,
      canva_token_expires_at: null,
      canva_user_id: null,
    }).eq("id", studioId)

    return null
  }
}

// ─── getCanvaDesigns ──────────────────────────────────────────────────────────

export async function getCanvaDesigns(): Promise<CanvaDesign[]> {
  await getAuthContext()
  const token = await refreshCanvaTokenIfNeeded()
  if (!token) throw new Error("Canva not connected")

  const res = await fetch("https://api.canva.com/rest/v1/designs?ownership=owned&limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error("Failed to fetch Canva designs")

  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = json.items ?? []

  return items
    .map((d) => ({
      id: d.id as string,
      title: (d.title ?? "Untitled") as string,
      thumbnail_url: (d.thumbnail?.url ?? null) as string | null,
      edit_url: `https://www.canva.com/design/${d.id}/edit`,
      view_url: `https://www.canva.com/design/${d.id}/view?embed`,
      created_at: (d.created_at ?? new Date().toISOString()) as string,
      updated_at: (d.updated_at ?? new Date().toISOString()) as string,
    }))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

// ─── createCanvaDesign ────────────────────────────────────────────────────────

export async function createCanvaDesign(title: string): Promise<CanvaDesign> {
  await getAuthContext()
  const token = await refreshCanvaTokenIfNeeded()
  if (!token) throw new Error("Canva not connected")

  const res = await fetch("https://api.canva.com/rest/v1/designs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      design_type: { type: "custom", width: 1920, height: 1080 },
      title,
    }),
  })

  if (!res.ok) throw new Error("Failed to create Canva design")

  const json = await res.json()
  const d = json.design ?? json

  return {
    id: d.id as string,
    title: (d.title ?? title) as string,
    thumbnail_url: (d.thumbnail?.url ?? null) as string | null,
    edit_url: `https://www.canva.com/design/${d.id}/edit`,
    view_url: `https://www.canva.com/design/${d.id}/view?embed`,
    created_at: (d.created_at ?? new Date().toISOString()) as string,
    updated_at: (d.updated_at ?? new Date().toISOString()) as string,
  }
}

// ─── createMoodboardWithNewDesign ─────────────────────────────────────────────

export async function createMoodboardWithNewDesign(input: {
  projectId: string
  title: string
  description?: string
}): Promise<import("./moodboards").Moodboard> {
  await getAuthContext()
  const { createMoodboard } = await import("./moodboards")

  const status = await getCanvaConnectionStatus()

  if (status.connected && !status.is_expired) {
    try {
      const design = await createCanvaDesign(input.title)
      return createMoodboard({
        project_id: input.projectId,
        title: input.title,
        description: input.description,
        canva_design_id: design.id,
        canva_embed_url: design.view_url,
        canva_edit_url: design.edit_url,
        thumbnail_url: design.thumbnail_url ?? undefined,
      })
    } catch {
      // fall through to create without Canva
    }
  }

  return createMoodboard({
    project_id: input.projectId,
    title: input.title,
    description: input.description,
  })
}

// ─── linkExistingCanvaDesign ──────────────────────────────────────────────────

export async function linkExistingCanvaDesign(
  moodboardId: string,
  designId: string
): Promise<import("./moodboards").Moodboard> {
  const { supabase, studioId } = await getAuthContext()
  const token = await refreshCanvaTokenIfNeeded()
  if (!token) throw new Error("Canva not connected")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: moodboard } = await (supabase.from as any)("moodboards")
    .select("studio_id, project_id")
    .eq("id", moodboardId)
    .single()

  if (!moodboard || moodboard.studio_id !== studioId) throw new Error("Not found")

  const res = await fetch(`https://api.canva.com/rest/v1/designs/${designId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error("Design not found in your Canva account")

  const json = await res.json()
  const d = json.design ?? json
  const thumbnailUrl = (d.thumbnail?.url ?? null) as string | null

  const { updateMoodboard } = await import("./moodboards")
  return updateMoodboard(moodboardId, {
    canva_design_id: designId,
    canva_embed_url: `https://www.canva.com/design/${designId}/view?embed`,
    canva_edit_url: `https://www.canva.com/design/${designId}/edit`,
    thumbnail_url: thumbnailUrl,
  })
}
