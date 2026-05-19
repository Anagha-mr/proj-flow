"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioGalleryItem {
  id: string
  studio_id: string
  project_id: string
  image_url: string
  caption: string | null
  space_tag: string | null
  display_order: number
  include_in_export: boolean
  uploaded_by_id: string | null
  uploaded_at: string
}

export interface PortfolioProject {
  id: string
  name: string
  type: string
  status: string
  cover_image_url: string | null
  portfolio_summary: string | null
  portfolio_key_decisions: string | null
  portfolio_location_city: string | null
  portfolio_year_completed: number | null
  portfolio_published: boolean
  client_name: string
  gallery_items: PortfolioGalleryItem[]
  gallery_count: number
  updated_at: string
  client_id: string | null
  members: Array<{ user_id: string; project_role: string; user: { id: string; name: string } | null }>
}

export interface PortfolioExportOptions {
  project_ids: string[]
  page_size: "A4" | "A3"
  orientation: "landscape" | "portrait"
  include_team_members: boolean
  include_scope_summary: boolean
  include_project_location: boolean
}

// ─── getPortfolioProjects ─────────────────────────────────────────────────────

export async function getPortfolioProjects(): Promise<PortfolioProject[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id, name, type, status, cover_image_url,
      portfolio_summary, portfolio_key_decisions,
      portfolio_location_city, portfolio_year_completed,
      portfolio_published, updated_at, client_id,
      members:project_members(user_id, project_role, user:users(id, name))
    `)
    .eq("studio_id", studioId)
    .or("portfolio_published.eq.true,status.in.(completed,archived)")

  if (error) throw new Error(error.message)
  if (!projects?.length) return []

  // Fetch clients separately
  const clientIds = [...new Set(projects.map((p) => p.client_id).filter(Boolean) as string[])]
  const clientMap: Record<string, string> = {}
  if (clientIds.length) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    clients?.forEach((c) => { clientMap[c.id] = c.name })
  }

  // Fetch gallery items separately
  const projectIds = projects.map((p) => p.id)
  const { data: galleryItems } = await supabase
    .from("portfolio_gallery_items")
    .select("*")
    .in("project_id", projectIds)
    .order("display_order", { ascending: true })

  const galleryMap: Record<string, PortfolioGalleryItem[]> = {}
  galleryItems?.forEach((item) => {
    if (!galleryMap[item.project_id]) galleryMap[item.project_id] = []
    galleryMap[item.project_id].push(item as PortfolioGalleryItem)
  })

  const result: PortfolioProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    status: p.status,
    cover_image_url: p.cover_image_url,
    portfolio_summary: p.portfolio_summary,
    portfolio_key_decisions: p.portfolio_key_decisions,
    portfolio_location_city: p.portfolio_location_city,
    portfolio_year_completed: p.portfolio_year_completed,
    portfolio_published: p.portfolio_published ?? false,
    client_name: p.client_id ? (clientMap[p.client_id] ?? "") : "",
    client_id: p.client_id,
    updated_at: p.updated_at,
    gallery_items: galleryMap[p.id] ?? [],
    gallery_count: (galleryMap[p.id] ?? []).length,
    members: (p.members as Array<{ user_id: string; project_role: string; user: { id: string; name: string } | null }>) ?? [],
  }))

  return result.sort((a, b) => {
    const yearDiff = (b.portfolio_year_completed ?? 0) - (a.portfolio_year_completed ?? 0)
    if (yearDiff !== 0) return yearDiff
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

// ─── getGalleryItems ──────────────────────────────────────────────────────────

export async function getGalleryItems(projectId: string): Promise<PortfolioGalleryItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("portfolio_gallery_items")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PortfolioGalleryItem[]
}

// ─── addGalleryItem ───────────────────────────────────────────────────────────

export async function addGalleryItem(input: {
  projectId: string
  imageUrl: string
  caption?: string
  spaceTag?: string
}): Promise<PortfolioGalleryItem> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  // Get current max display_order
  const { data: maxRow } = await supabase
    .from("portfolio_gallery_items")
    .select("display_order")
    .eq("project_id", input.projectId)
    .order("display_order", { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from("portfolio_gallery_items")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      image_url: input.imageUrl,
      caption: input.caption ?? null,
      space_tag: input.spaceTag ?? null,
      display_order: nextOrder,
      uploaded_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  revalidatePath("/dashboard/portfolio")

  return data as PortfolioGalleryItem
}

// ─── updateGalleryItem ────────────────────────────────────────────────────────

export async function updateGalleryItem(
  itemId: string,
  updates: Partial<Pick<PortfolioGalleryItem, "caption" | "space_tag" | "include_in_export">>
): Promise<PortfolioGalleryItem> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("portfolio_gallery_items")
    .select("studio_id, project_id")
    .eq("id", itemId)
    .single()

  if (!item || item.studio_id !== studioId) throw new Error("Not found")

  const { data, error } = await supabase
    .from("portfolio_gallery_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${item.project_id}`)
  revalidatePath("/dashboard/portfolio")

  return data as PortfolioGalleryItem
}

// ─── reorderGalleryItems ──────────────────────────────────────────────────────

export async function reorderGalleryItems(projectId: string, orderedIds: string[]): Promise<void> {
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
      await supabase
        .from("portfolio_gallery_items")
        .update({ display_order: i })
        .eq("id", orderedIds[i])
        .eq("project_id", projectId)
    }
  } catch (err) {
    throw new Error("Failed to reorder gallery items")
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath("/dashboard/portfolio")
}

// ─── deleteGalleryItem ────────────────────────────────────────────────────────

export async function deleteGalleryItem(itemId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("portfolio_gallery_items")
    .select("studio_id, project_id")
    .eq("id", itemId)
    .single()

  if (!item || item.studio_id !== studioId) throw new Error("Not found")

  const { error } = await supabase
    .from("portfolio_gallery_items")
    .delete()
    .eq("id", itemId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${item.project_id}`)
  revalidatePath("/dashboard/portfolio")
}

// ─── updatePortfolioDetails ───────────────────────────────────────────────────

export async function updatePortfolioDetails(
  projectId: string,
  updates: {
    portfolio_summary?: string
    portfolio_key_decisions?: string
    portfolio_location_city?: string
    portfolio_year_completed?: number | null
    portfolio_published?: boolean
  }
): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner" && role !== "senior_designer") {
    throw new Error("Insufficient permissions")
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath("/dashboard/portfolio")
}

// ─── getPortfolioExportData ───────────────────────────────────────────────────

export async function getPortfolioExportData(projectIds: string[]): Promise<PortfolioProject[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id, name, type, status, cover_image_url,
      portfolio_summary, portfolio_key_decisions,
      portfolio_location_city, portfolio_year_completed,
      portfolio_published, updated_at, client_id,
      members:project_members(user_id, project_role, user:users(id, name))
    `)
    .in("id", projectIds)

  if (error) throw new Error(error.message)

  // Verify all belong to this studio
  const allBelong = (projects ?? []).every((p) => {
    // We verify via studio_id filter separately
    return true
  })

  // Additional check: re-fetch with studio_id filter
  const { data: verifiedProjects } = await supabase
    .from("projects")
    .select("id")
    .in("id", projectIds)
    .eq("studio_id", studioId)

  const verifiedIds = new Set((verifiedProjects ?? []).map((p) => p.id))
  for (const pid of projectIds) {
    if (!verifiedIds.has(pid)) throw new Error("Unauthorized project access")
  }

  // Fetch clients
  const clientIds = [...new Set((projects ?? []).map((p) => p.client_id).filter(Boolean) as string[])]
  const clientMap: Record<string, string> = {}
  if (clientIds.length) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds)
    clients?.forEach((c) => { clientMap[c.id] = c.name })
  }

  // Fetch gallery items in a single .in() query
  const { data: galleryItems } = await supabase
    .from("portfolio_gallery_items")
    .select("*")
    .in("project_id", projectIds)
    .eq("include_in_export", true)
    .order("display_order", { ascending: true })

  const galleryMap: Record<string, PortfolioGalleryItem[]> = {}
  galleryItems?.forEach((item) => {
    if (!galleryMap[item.project_id]) galleryMap[item.project_id] = []
    galleryMap[item.project_id].push(item as PortfolioGalleryItem)
  })

  // Return in the order of projectIds as passed
  return projectIds.map((pid) => {
    const p = (projects ?? []).find((proj) => proj.id === pid)!
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      cover_image_url: p.cover_image_url,
      portfolio_summary: p.portfolio_summary,
      portfolio_key_decisions: p.portfolio_key_decisions,
      portfolio_location_city: p.portfolio_location_city,
      portfolio_year_completed: p.portfolio_year_completed,
      portfolio_published: p.portfolio_published ?? false,
      client_name: p.client_id ? (clientMap[p.client_id] ?? "") : "",
      client_id: p.client_id,
      updated_at: p.updated_at,
      gallery_items: galleryMap[p.id] ?? [],
      gallery_count: (galleryMap[p.id] ?? []).length,
      members: (p.members as Array<{ user_id: string; project_role: string; user: { id: string; name: string } | null }>) ?? [],
    }
  })
}
