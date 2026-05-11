"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewType = 'room_based' | 'schedule_based'
export type ScheduleStatus = 'draft' | 'in_review' | 'approved' | 'ordered' | 'delivered'
export type CurationStatus = 'draft' | 'hidden' | 'quoting' | 'selected' | 'internal_review' | 'internally_approved'
export type ClientApprovalStatus = 'client_review' | 'approved' | 'rejected' | 'resubmit' | 'closed'
export type ProcurementStatus = 'ordered' | 'in_production' | 'in_transit' | 'delivered' | 'installed'
export type PaymentStatus = 'invoiced' | 'payment_due' | 'partial_payment' | 'paid'

export interface ProcurementSchedule {
  id: string
  studio_id: string
  project_id: string
  name: string
  view_type: ViewType
  status: ScheduleStatus
  owner_id: string | null
  is_client_published: boolean
  is_archived: boolean
  client_can_view_supplier: boolean
  client_can_view_brand: boolean
  client_can_view_pricing: boolean
  client_can_view_details: boolean
  client_can_approve: boolean
  share_token: string
  share_token_expires_at: string | null
  share_enabled: boolean
  created_at: string
  updated_at: string
  owner?: { name: string }
  item_count?: number
  total_cost?: number
  approved_count?: number
}

export interface ProcurementItem {
  id: string
  studio_id: string
  project_id: string
  schedule_id: string
  room_or_category: string | null
  name: string
  description: string | null
  product_code: string | null
  brand: string | null
  supplier_name: string | null
  source_url: string | null
  dimensions_length: number | null
  dimensions_height: number | null
  dimensions_depth: number | null
  dimensions_unit: string
  finish: string | null
  material: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  image_url: string | null
  quotation_attachment_url: string | null
  in_stock: boolean | null
  is_flagged: boolean
  is_archived: boolean
  position: number
  created_at: string
  updated_at: string
  status?: ProcurementItemStatus
}

export interface ProcurementItemStatus {
  id: string
  item_id: string
  curation_status: CurationStatus
  client_approval_status: ClientApprovalStatus
  procurement_status: ProcurementStatus
  payment_status: PaymentStatus
  client_comment: string | null
  updated_at: string
}

// ─── getSchedules ─────────────────────────────────────────────────────────────

export async function getSchedules(projectId: string): Promise<ProcurementSchedule[]> {
  const { supabase, studioId } = await getAuthContext()

  // Verify project belongs to this studio
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: schedules, error } = await supabase
    .from("procurement_schedules")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!schedules || schedules.length === 0) return []

  const scheduleIds = schedules.map((s) => s.id)

  // Fetch items separately — never join to avoid nested RLS issues
  const { data: items } = await supabase
    .from("procurement_items")
    .select("schedule_id, total_cost, is_archived")
    .in("schedule_id", scheduleIds)
    .eq("studio_id", studioId)

  // Fetch approved status counts
  const nonArchivedItemIds: string[] = []
  const { data: allItems } = await supabase
    .from("procurement_items")
    .select("id, schedule_id, is_archived")
    .in("schedule_id", scheduleIds)
    .eq("studio_id", studioId)
  ;(allItems ?? []).forEach((i) => { if (!i.is_archived) nonArchivedItemIds.push(i.id) })

  let approvedMap: Record<string, number> = {}
  if (nonArchivedItemIds.length > 0) {
    const { data: statusRows } = await supabase
      .from("procurement_item_status")
      .select("item_id, client_approval_status")
      .in("item_id", nonArchivedItemIds)
      .eq("client_approval_status", "approved")
    ;(statusRows ?? []).forEach((s) => {
      const item = (allItems ?? []).find((i) => i.id === s.item_id)
      if (item) approvedMap[item.schedule_id] = (approvedMap[item.schedule_id] ?? 0) + 1
    })
  }

  // Fetch owner names in a separate query
  const ownerIds = [...new Set(schedules.map((s) => s.owner_id).filter(Boolean))] as string[]
  const ownerMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from("users")
      .select("id, name")
      .in("id", ownerIds)
    ;(owners ?? []).forEach((o) => { ownerMap[o.id] = o.name })
  }

  // Compute per-schedule aggregates
  const costMap: Record<string, number> = {}
  const countMap: Record<string, number> = {}
  ;(items ?? []).forEach((item) => {
    if (!item.is_archived) {
      costMap[item.schedule_id] = (costMap[item.schedule_id] ?? 0) + (item.total_cost ?? 0)
      countMap[item.schedule_id] = (countMap[item.schedule_id] ?? 0) + 1
    }
  })

  const result = schedules.map((s) => ({
    ...s,
    owner: s.owner_id ? { name: ownerMap[s.owner_id] ?? "Unknown" } : undefined,
    item_count: countMap[s.id] ?? 0,
    total_cost: costMap[s.id] ?? 0,
    approved_count: approvedMap[s.id] ?? 0,
  })) as ProcurementSchedule[]

  // Sort: non-archived first by updated_at DESC, then archived
  return [
    ...result.filter((s) => !s.is_archived),
    ...result.filter((s) => s.is_archived),
  ]
}

// ─── createSchedule ───────────────────────────────────────────────────────────

export async function createSchedule(input: {
  projectId: string
  name: string
  viewType?: ViewType
}): Promise<ProcurementSchedule> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data, error } = await supabase
    .from("procurement_schedules")
    .insert({
      project_id: input.projectId,
      studio_id: studioId,
      name: input.name || "Untitled",
      view_type: input.viewType ?? "schedule_based",
      created_by_id: userId,
      owner_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as ProcurementSchedule
}

// ─── updateSchedule ───────────────────────────────────────────────────────────

export async function updateSchedule(
  scheduleId: string,
  updates: Partial<Pick<ProcurementSchedule,
    | 'name' | 'view_type' | 'status' | 'is_client_published' | 'is_archived'
    | 'client_can_view_supplier' | 'client_can_view_brand' | 'client_can_view_pricing'
    | 'client_can_view_details' | 'client_can_approve'
  >>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("project_id")
    .eq("id", scheduleId)
    .eq("studio_id", studioId)
    .single()
  if (!schedule) throw new Error("Schedule not found")

  const { error } = await supabase
    .from("procurement_schedules")
    .update(updates)
    .eq("id", scheduleId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${schedule.project_id}`)
}

// ─── toggleScheduleShare ──────────────────────────────────────────────────────

export async function toggleScheduleShare(
  scheduleId: string,
  enabled: boolean,
  expiresAt?: string
): Promise<{ shareToken: string }> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedule, error: fetchErr } = await supabase
    .from("procurement_schedules")
    .select("project_id, share_token")
    .eq("id", scheduleId)
    .eq("studio_id", studioId)
    .single()
  if (fetchErr || !schedule) throw new Error("Schedule not found")

  const { error } = await supabase
    .from("procurement_schedules")
    .update({
      share_enabled: enabled,
      share_token_expires_at: expiresAt ?? null,
    })
    .eq("id", scheduleId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${schedule.project_id}`)
  return { shareToken: schedule.share_token }
}

// ─── getItems ─────────────────────────────────────────────────────────────────

export async function getItems(scheduleId: string): Promise<ProcurementItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("id")
    .eq("id", scheduleId)
    .eq("studio_id", studioId)
    .single()
  if (!schedule) throw new Error("Schedule not found")

  const { data: items, error } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("studio_id", studioId)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  if (!items || items.length === 0) return []

  const itemIds = items.map((i) => i.id)

  // Fetch status rows in a separate query — avoids nested RLS join failure
  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("*")
    .in("item_id", itemIds)

  const statusMap: Record<string, ProcurementItemStatus> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = s as ProcurementItemStatus })

  return items.map((item) => ({
    ...item,
    status: statusMap[item.id],
  })) as ProcurementItem[]
}

// ─── createItem ───────────────────────────────────────────────────────────────

export async function createItem(input: {
  scheduleId: string
  projectId: string
  name: string
  roomOrCategory?: string
  quantity?: number
  unitCost?: number
  imageUrl?: string
  sourceUrl?: string
  brand?: string
  supplierName?: string
  description?: string
}): Promise<ProcurementItem> {
  const { supabase, studioId, userId } = await getAuthContext()

  // Verify schedule belongs to this studio
  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("id")
    .eq("id", input.scheduleId)
    .eq("studio_id", studioId)
    .single()
  if (!schedule) throw new Error("Schedule not found")

  // Get max position for this schedule
  const { data: maxRow } = await supabase
    .from("procurement_items")
    .select("position")
    .eq("schedule_id", input.scheduleId)
    .order("position", { ascending: false })
    .limit(1)
    .single()

  const nextPosition = maxRow ? maxRow.position + 1 : 0

  const { data: item, error } = await supabase
    .from("procurement_items")
    .insert({
      schedule_id: input.scheduleId,
      project_id: input.projectId,
      studio_id: studioId,
      name: input.name,
      room_or_category: input.roomOrCategory ?? null,
      quantity: input.quantity ?? 1,
      unit_cost: input.unitCost ?? 0,
      image_url: input.imageUrl ?? null,
      source_url: input.sourceUrl ?? null,
      brand: input.brand ?? null,
      supplier_name: input.supplierName ?? null,
      description: input.description ?? null,
      position: nextPosition,
      created_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Immediately insert a matching status row
  const { data: statusRow, error: statusErr } = await supabase
    .from("procurement_item_status")
    .insert({
      item_id: item.id,
      studio_id: studioId,
    })
    .select()
    .single()

  if (statusErr) throw new Error(statusErr.message)

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return { ...item, status: statusRow } as ProcurementItem
}

// ─── updateItem ───────────────────────────────────────────────────────────────

export async function updateItem(
  itemId: string,
  updates: Partial<Omit<ProcurementItem, 'id' | 'studio_id' | 'project_id' | 'schedule_id' | 'total_cost' | 'created_at' | 'updated_at' | 'status'>>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("procurement_items")
    .select("project_id")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!item) throw new Error("Item not found")

  // Never write total_cost — it is a computed column; strip it before sending
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { total_cost: _tc, status: _st, ...safeUpdates } = updates as Record<string, unknown>

  const { error } = await supabase
    .from("procurement_items")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(safeUpdates as any)
    .eq("id", itemId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

// ─── updateItemStatus ─────────────────────────────────────────────────────────

export async function updateItemStatus(
  itemId: string,
  statusUpdates: Partial<Pick<ProcurementItemStatus,
    'curation_status' | 'client_approval_status' | 'procurement_status' | 'payment_status' | 'client_comment'
  >>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("procurement_items")
    .select("project_id")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!item) throw new Error("Item not found")

  const { error } = await supabase
    .from("procurement_item_status")
    .upsert(
      { item_id: itemId, studio_id: studioId, ...statusUpdates },
      { onConflict: "item_id" }
    )

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

// ─── reorderItems ─────────────────────────────────────────────────────────────

export async function reorderItems(scheduleId: string, orderedItemIds: string[]): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("project_id")
    .eq("id", scheduleId)
    .eq("studio_id", studioId)
    .single()
  if (!schedule) throw new Error("Schedule not found")

  for (let i = 0; i < orderedItemIds.length; i++) {
    await supabase
      .from("procurement_items")
      .update({ position: i })
      .eq("id", orderedItemIds[i])
      .eq("studio_id", studioId)
  }

  revalidatePath(`/dashboard/projects/${schedule.project_id}`)
}

// ─── deleteItem ───────────────────────────────────────────────────────────────

export async function deleteItem(itemId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("procurement_items")
    .select("project_id")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!item) throw new Error("Item not found")

  const { error } = await supabase
    .from("procurement_items")
    .delete()
    .eq("id", itemId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

// ─── archiveItem ──────────────────────────────────────────────────────────────

export async function archiveItem(itemId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await supabase
    .from("procurement_items")
    .select("project_id")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!item) throw new Error("Item not found")

  const { error } = await supabase
    .from("procurement_items")
    .update({ is_archived: true })
    .eq("id", itemId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

// ─── enrichItemFromUrl ────────────────────────────────────────────────────────

export async function enrichItemFromUrl(url: string): Promise<Partial<ProcurementItem>> {
  // Fetch page HTML server-side
  let html = ""
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    })
    html = await res.text()
    // Truncate HTML to ~50k chars to stay within token limits
    if (html.length > 50000) html = html.slice(0, 50000)
  } catch {
    throw new Error("Failed to fetch the URL. Please check that it is publicly accessible.")
  }

  const client = new Anthropic()
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a product data extractor for an interior design procurement tool.
Extract product information from the provided HTML and return ONLY valid JSON
(no preamble, no backticks, no markdown) with these fields:
name, description, brand, product_code, unit_cost (number only, in INR if detectable),
dimensions_length, dimensions_height, dimensions_depth, dimensions_unit,
finish, material, image_url (the main product image URL if extractable).
If a field cannot be determined, omit it from the JSON entirely.`,
    messages: [{ role: "user", content: html }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : "{}"
  try {
    const parsed = JSON.parse(text)
    return parsed as Partial<ProcurementItem>
  } catch {
    throw new Error("Could not extract product details from this page.")
  }
}

// ─── getSchedulePublic ────────────────────────────────────────────────────────

export async function getSchedulePublic(
  shareToken: string
): Promise<{ schedule: ProcurementSchedule; items: ProcurementItem[] } | null> {
  // No auth required — public endpoint
  const supabase = await createClient()

  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("*")
    .eq("share_token", shareToken)
    .eq("share_enabled", true)
    .single()

  if (!schedule) return null

  // Check expiry
  if (schedule.share_token_expires_at && new Date(schedule.share_token_expires_at) < new Date()) {
    return null
  }

  const { data: items } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("schedule_id", schedule.id)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (!items || items.length === 0) {
    return { schedule: schedule as ProcurementSchedule, items: [] }
  }

  const itemIds = items.map((i) => i.id)
  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("*")
    .in("item_id", itemIds)

  const statusMap: Record<string, ProcurementItemStatus> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = s as ProcurementItemStatus })

  const itemsWithStatus = items.map((item) => ({
    ...item,
    status: statusMap[item.id],
  })) as ProcurementItem[]

  return { schedule: schedule as ProcurementSchedule, items: itemsWithStatus }
}

// ─── clientApproveItem ────────────────────────────────────────────────────────

export async function clientApproveItem(input: {
  itemId: string
  projectPortalToken: string
  action: 'approved' | 'rejected' | 'resubmit'
  comment?: string
}): Promise<void> {
  const supabase = await createClient()

  if ((input.action === 'rejected' || input.action === 'resubmit') && !input.comment?.trim()) {
    throw new Error("A comment is required when requesting revision or declining")
  }

  // Validate portal_token against clients table
  const { data: client } = await supabase
    .from("clients")
    .select("studio_id, id")
    .eq("portal_token", input.projectPortalToken)
    .single()

  if (!client) throw new Error("Invalid or expired portal token")

  // Check expiry if applicable
  const { data: clientFull } = await supabase
    .from("clients")
    .select("portal_token_expires_at")
    .eq("portal_token", input.projectPortalToken)
    .single()

  if (
    clientFull?.portal_token_expires_at &&
    new Date(clientFull.portal_token_expires_at) < new Date()
  ) {
    throw new Error("Portal token has expired")
  }

  // Verify item belongs to same studio as client
  const { data: item } = await supabase
    .from("procurement_items")
    .select("studio_id, project_id")
    .eq("id", input.itemId)
    .single()

  if (!item || item.studio_id !== client.studio_id) {
    throw new Error("Unauthorized")
  }

  const { error } = await supabase
    .from("procurement_item_status")
    .update({
      client_approval_status: input.action,
      client_comment: input.comment ?? null,
    })
    .eq("item_id", input.itemId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

// ─── getScheduleSummary ───────────────────────────────────────────────────────

export async function getScheduleSummary(projectId: string): Promise<{
  totalItems: number
  totalCost: number
  approvedItems: number
  approvedCost: number
  pendingApproval: number
}> {
  const { supabase, studioId } = await getAuthContext()

  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, total_cost, is_archived")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .eq("is_archived", false)

  if (!items || items.length === 0) {
    return { totalItems: 0, totalCost: 0, approvedItems: 0, approvedCost: 0, pendingApproval: 0 }
  }

  const itemIds = items.map((i) => i.id)

  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("item_id, client_approval_status")
    .in("item_id", itemIds)

  const statusMap: Record<string, string> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = s.client_approval_status })

  let totalItems = items.length
  let totalCost = 0
  let approvedItems = 0
  let approvedCost = 0
  let pendingApproval = 0

  for (const item of items) {
    const cost = item.total_cost ?? 0
    totalCost += cost
    const status = statusMap[item.id]
    if (status === "approved") {
      approvedItems++
      approvedCost += cost
    } else if (status === "client_review") {
      pendingApproval++
    }
  }

  return { totalItems, totalCost, approvedItems, approvedCost, pendingApproval }
}

// ─── getAllItemsForApprovals ───────────────────────────────────────────────────

export async function getAllItemsForApprovals(projectId: string): Promise<ProcurementItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedules } = await supabase
    .from("procurement_schedules")
    .select("id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .eq("is_archived", false)

  if (!schedules || schedules.length === 0) return []

  const scheduleIds = schedules.map((s) => s.id)

  const { data: items, error } = await supabase
    .from("procurement_items")
    .select("*")
    .in("schedule_id", scheduleIds)
    .eq("studio_id", studioId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!items || items.length === 0) return []

  const itemIds = items.map((i) => i.id)
  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("*")
    .in("item_id", itemIds)

  const statusMap: Record<string, ProcurementItemStatus> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = s as ProcurementItemStatus })

  return items.map((item) => ({ ...item, status: statusMap[item.id] })) as ProcurementItem[]
}

// ─── getSchedulesForFinancial ─────────────────────────────────────────────────

export async function getSchedulesForFinancial(projectId: string): Promise<
  Array<{
    id: string
    name: string
    status: ScheduleStatus
    items: Array<{ name: string; total_cost: number; client_approval_status: string }>
  }>
> {
  const { supabase, studioId } = await getAuthContext()

  const { data: schedules } = await supabase
    .from("procurement_schedules")
    .select("id, name, status")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .eq("is_archived", false)

  if (!schedules || schedules.length === 0) return []

  const scheduleIds = schedules.map((s) => s.id)

  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, name, total_cost, schedule_id")
    .in("schedule_id", scheduleIds)
    .eq("studio_id", studioId)
    .eq("is_archived", false)

  if (!items || items.length === 0) {
    return schedules.map((s) => ({ ...s, items: [] })) as Array<{
      id: string; name: string; status: ScheduleStatus
      items: Array<{ name: string; total_cost: number; client_approval_status: string }>
    }>
  }

  const itemIds = items.map((i) => i.id)
  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("item_id, client_approval_status")
    .in("item_id", itemIds)

  const statusMap: Record<string, string> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = s.client_approval_status })

  return schedules.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status as ScheduleStatus,
    items: items
      .filter((i) => i.schedule_id === s.id)
      .map((i) => ({
        name: i.name,
        total_cost: i.total_cost ?? 0,
        client_approval_status: statusMap[i.id] ?? "client_review",
      })),
  }))
}
