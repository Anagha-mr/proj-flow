"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export interface OrderTrackingRow {
  id: string
  studio_id: string
  project_id: string
  procurement_item_id: string
  vendor_id: string | null
  order_number: string | null
  tracking_link: string | null
  shipment_notes: string | null
  status: 'ordered' | 'in_production' | 'in_transit' | 'customs_hold' | 'delayed' | 'delivered' | 'installed'
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  client_deposit_paid: number | null
  client_deposit_paid_date: string | null
  supplier_deposit_paid: number | null
  supplier_deposit_paid_date: string | null
  client_balance_due: number | null
  client_balance_due_date: string | null
  supplier_balance_due: number | null
  supplier_balance_due_date: string | null
  delay_notified_at: string | null
  created_at: string
  updated_at: string
  // merged
  item_name: string
  item_image_url: string | null
  item_total_cost: number | null
  vendor_name: string | null
}

export interface OrderSummary {
  total_orders: number
  delivered: number
  in_transit: number
  delayed: number
  total_value_ordered: number
  total_value_delivered: number
}

export type CreateOrderInput = {
  project_id: string
  procurement_item_id: string
  vendor_id?: string
  order_number?: string
  expected_delivery_date?: string
  status?: OrderTrackingRow['status']
}

export type UpdateOrderInput = Partial<Omit<
  OrderTrackingRow,
  'id' | 'studio_id' | 'project_id' | 'procurement_item_id' | 'delay_notified_at' | 'created_at' | 'updated_at' | 'item_name' | 'item_image_url' | 'item_total_cost' | 'vendor_name'
>>

async function mergeOrderRows(
  rows: Array<Record<string, unknown>>,
  supabase: Awaited<ReturnType<typeof getAuthContext>>['supabase']
): Promise<OrderTrackingRow[]> {
  if (rows.length === 0) return []

  const itemIds = [...new Set(rows.map((r) => r.procurement_item_id as string))]
  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, name, image_url, total_cost")
    .in("id", itemIds)
  const itemMap = Object.fromEntries((items ?? []).map((i: Record<string, unknown>) => [i.id, i]))

  const vendorIds = [...new Set(rows.map((r) => r.vendor_id as string).filter(Boolean))]
  const vendorMap: Record<string, string> = {}
  if (vendorIds.length > 0) {
    const { data: vendors } = await (supabase.from as AnyQuery)("vendors")
      .select("id, name")
      .in("id", vendorIds)
    ;(vendors ?? []).forEach((v: { id: string; name: string }) => { vendorMap[v.id] = v.name })
  }

  return rows.map((r) => ({
    ...(r as Omit<OrderTrackingRow, 'item_name' | 'item_image_url' | 'item_total_cost' | 'vendor_name'>),
    item_name: (itemMap[r.procurement_item_id as string] as Record<string, unknown>)?.name as string ?? "—",
    item_image_url: (itemMap[r.procurement_item_id as string] as Record<string, unknown>)?.image_url as string ?? null,
    item_total_cost: (itemMap[r.procurement_item_id as string] as Record<string, unknown>)?.total_cost as number ?? null,
    vendor_name: r.vendor_id ? (vendorMap[r.vendor_id as string] ?? null) : null,
  })) as OrderTrackingRow[]
}

export async function getOrderTracking(projectId: string): Promise<OrderTrackingRow[]> {
  const { supabase, studioId } = await getAuthContext()
  const { data, error } = await (supabase.from as AnyQuery)("order_tracking")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return mergeOrderRows((data ?? []) as Array<Record<string, unknown>>, supabase)
}

async function findOrderForItem(supabase: AnyQuery, procurementItemId: string) {
  const { data } = await (supabase.from as AnyQuery)("order_tracking")
    .select("id")
    .eq("procurement_item_id", procurementItemId)
    .maybeSingle()
  return data
}

async function insertOrderTracking(
  supabase: AnyQuery,
  studioId: string,
  input: CreateOrderInput
) {
  const { data, error } = await (supabase.from as AnyQuery)("order_tracking")
    .insert({
      studio_id: studioId,
      project_id: input.project_id,
      procurement_item_id: input.procurement_item_id,
      vendor_id: input.vendor_id ?? null,
      order_number: input.order_number ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      status: input.status ?? 'ordered',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await supabase
    .from("procurement_item_status")
    .update({ procurement_status: 'ordered' })
    .eq("item_id", input.procurement_item_id)

  return data
}

export async function createOrderTracking(input: CreateOrderInput): Promise<OrderTrackingRow> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item, error: itemErr } = await supabase
    .from("procurement_items")
    .select("id, studio_id")
    .eq("id", input.procurement_item_id)
    .single()
  if (itemErr || !item) throw new Error("Procurement item not found")
  if (item.studio_id !== studioId) throw new Error("Unauthorized")

  const existing = await findOrderForItem(supabase, input.procurement_item_id)
  if (existing) throw new Error("An order is already being tracked for this item")

  const data = await insertOrderTracking(supabase, studioId, input)

  revalidatePath(`/dashboard/projects/${input.project_id}`)
  const merged = await mergeOrderRows([data as Record<string, unknown>], supabase)
  return merged[0]
}

// ─── createOrderFromApproval ────────────────────────────────────────────────
// Auto-creates the order_tracking record when a procurement item's
// client_approval_status transitions to 'approved'. Called from
// app/actions/procurement.ts on both the internal approval path and the
// client-portal (no-session) approval path, so it takes an explicit supabase
// client + studioId rather than resolving them via getAuthContext. No-ops if
// an order already exists for the item, so re-approval never double-inserts.
export async function createOrderFromApproval(
  supabase: AnyQuery,
  studioId: string,
  projectId: string,
  procurementItemId: string,
  vendorId?: string | null
): Promise<void> {
  const existing = await findOrderForItem(supabase, procurementItemId)
  if (existing) return

  const { data: statusRow } = await (supabase.from as AnyQuery)("procurement_item_status")
    .select("client_approval_status")
    .eq("item_id", procurementItemId)
    .single()
  if (statusRow?.client_approval_status !== 'approved') {
    throw new Error("Cannot create order: item is not approved")
  }

  await insertOrderTracking(supabase, studioId, {
    project_id: projectId,
    procurement_item_id: procurementItemId,
    vendor_id: vendorId ?? undefined,
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function updateOrderTracking(id: string, updates: UpdateOrderInput): Promise<OrderTrackingRow> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await (supabase.from as AnyQuery)("order_tracking")
    .select("studio_id, status, project_id")
    .eq("id", id)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Unauthorized")

  const finalUpdates: Record<string, unknown> = { ...updates }
  if (
    updates.actual_delivery_date &&
    existing.status !== 'delivered' &&
    existing.status !== 'installed'
  ) {
    finalUpdates.status = 'delivered'
  }

  const { data, error } = await (supabase.from as AnyQuery)("order_tracking")
    .update(finalUpdates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${existing.project_id}`)
  const merged = await mergeOrderRows([data as Record<string, unknown>], supabase)
  return merged[0]
}

export async function deleteOrderTracking(id: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const { data: existing } = await (supabase.from as AnyQuery)("order_tracking")
    .select("studio_id, project_id")
    .eq("id", id)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Unauthorized")

  const { error } = await (supabase.from as AnyQuery)("order_tracking").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${existing.project_id}`)
}

export async function getProjectOrderSummary(projectId: string): Promise<OrderSummary> {
  const { supabase, studioId } = await getAuthContext()
  const { data: rows } = await (supabase.from as AnyQuery)("order_tracking")
    .select("id, procurement_item_id, status, expected_delivery_date")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (!rows || rows.length === 0) {
    return { total_orders: 0, delivered: 0, in_transit: 0, delayed: 0, total_value_ordered: 0, total_value_delivered: 0 }
  }

  const today = new Date().toISOString().split('T')[0]
  const itemIds = rows.map((r: Record<string, unknown>) => r.procurement_item_id as string)
  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, total_cost")
    .in("id", itemIds)
  const costMap = Object.fromEntries((items ?? []).map((i) => [i.id, i.total_cost ?? 0]))

  const delivered = rows.filter((r: Record<string, unknown>) => r.status === 'delivered' || r.status === 'installed')
  const delayed = rows.filter((r: Record<string, unknown>) =>
    r.expected_delivery_date &&
    (r.expected_delivery_date as string) < today &&
    r.status !== 'delivered' &&
    r.status !== 'installed'
  )

  return {
    total_orders: rows.length,
    delivered: delivered.length,
    in_transit: rows.filter((r: Record<string, unknown>) => r.status === 'in_transit').length,
    delayed: delayed.length,
    total_value_ordered: rows.reduce((sum: number, r: Record<string, unknown>) => sum + (costMap[r.procurement_item_id as string] ?? 0), 0),
    total_value_delivered: delivered.reduce((sum: number, r: Record<string, unknown>) => sum + (costMap[r.procurement_item_id as string] ?? 0), 0),
  }
}

export async function checkAndNotifyDelays(projectId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const today = new Date().toISOString().split('T')[0]
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: rows } = await (supabase.from as AnyQuery)("order_tracking")
    .select("id, procurement_item_id, expected_delivery_date, delay_notified_at")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .lt("expected_delivery_date", today)
    .not("status", "in", '("delivered","installed")')

  if (!rows || rows.length === 0) return

  const toNotify = rows.filter(
    (r: Record<string, unknown>) => !r.delay_notified_at || (r.delay_notified_at as string) < threshold
  )
  if (toNotify.length === 0) return

  const itemIds = toNotify.map((r: Record<string, unknown>) => r.procurement_item_id as string)
  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, name")
    .in("id", itemIds)
  const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i.name]))

  const { notifyOrderDelayed } = await import("./notifications")

  for (const row of toNotify) {
    try {
      notifyOrderDelayed(
        studioId,
        projectId,
        itemMap[(row as Record<string, unknown>).procurement_item_id as string] ?? "Unknown item",
        (row as Record<string, unknown>).expected_delivery_date as string ?? ""
      ).catch(() => {})

      await (supabase.from as AnyQuery)("order_tracking")
        .update({ delay_notified_at: new Date().toISOString() })
        .eq("id", (row as Record<string, unknown>).id)
    } catch {
      // silent
    }
  }
}
