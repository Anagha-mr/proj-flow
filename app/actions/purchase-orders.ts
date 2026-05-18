"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export interface POLineItem {
  procurement_item_id: string | null
  name: string
  product_code: string | null
  quantity: number
  unit: string | null
  unit_price: number
  gst_rate: number
  gst_amount: number
  line_total: number
}

export interface PurchaseOrder {
  id: string
  studio_id: string
  project_id: string
  vendor_id: string
  po_number: string
  po_date: string
  line_items: POLineItem[]
  subtotal: number
  gst_total: number
  grand_total: number
  delivery_address: string | null
  expected_delivery_date: string | null
  payment_terms: {
    deposit_amount?: number
    deposit_due_date?: string
    balance_amount?: number
    balance_due_date?: string
  }
  special_instructions: string | null
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'confirmed_by_vendor' | 'cancelled'
  approved_by_id: string | null
  approved_at: string | null
  sent_at: string | null
  vendor_confirmed_at: string | null
  created_by_id: string
  created_at: string
  updated_at: string
  // merged
  vendor_name?: string
  vendor_whatsapp?: string | null
}

export type CreatePOInput = {
  project_id: string
  vendor_id: string
  line_items: Omit<POLineItem, 'gst_amount' | 'line_total'>[]
  delivery_address?: string
  expected_delivery_date?: string
  payment_terms?: PurchaseOrder['payment_terms']
  special_instructions?: string
}

async function generatePONumber(
  studioId: string,
  studioName: string,
  supabase: Awaited<ReturnType<typeof getAuthContext>>['supabase']
): Promise<string> {
  const prefix = studioName.slice(0, 2).toUpperCase()
  const year = new Date().getFullYear()
  const pattern = `PO-${prefix}-${year}-%`

  const { count } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .like("po_number", pattern)

  const seq = (count ?? 0) + 1
  return `PO-${prefix}-${year}-${seq.toString().padStart(4, '0')}`
}

function computeLineItems(rawItems: Omit<POLineItem, 'gst_amount' | 'line_total'>[]): {
  lineItems: POLineItem[]
  subtotal: number
  gstTotal: number
  grandTotal: number
} {
  let subtotal = 0
  let gstTotal = 0

  const lineItems: POLineItem[] = rawItems.map((item) => {
    const itemSubtotal = item.unit_price * item.quantity
    const gstAmount = Math.round(itemSubtotal * item.gst_rate / 100)
    const lineTotal = itemSubtotal + gstAmount
    subtotal += itemSubtotal
    gstTotal += gstAmount
    return { ...item, gst_amount: gstAmount, line_total: lineTotal }
  })

  return { lineItems, subtotal, gstTotal, grandTotal: subtotal + gstTotal }
}

async function mergePOVendors(
  rows: PurchaseOrder[],
  supabase: Awaited<ReturnType<typeof getAuthContext>>['supabase']
): Promise<PurchaseOrder[]> {
  if (rows.length === 0) return []
  const vendorIds = [...new Set(rows.map((r) => r.vendor_id))]
  const { data: vendors } = await (supabase.from as AnyQuery)("vendors")
    .select("id, name, whatsapp_number")
    .in("id", vendorIds)
  const vendorMap = Object.fromEntries(
    ((vendors ?? []) as Array<Record<string, unknown>>).map((v) => [v.id, v])
  )
  return rows.map((r) => ({
    ...r,
    vendor_name: (vendorMap[r.vendor_id] as Record<string, unknown>)?.name as string ?? undefined,
    vendor_whatsapp: (vendorMap[r.vendor_id] as Record<string, unknown>)?.whatsapp_number as string ?? null,
  }))
}

export async function getPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
  const { supabase, studioId } = await getAuthContext()
  const { data, error } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("*")
    .eq("studio_id", studioId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return mergePOVendors((data ?? []) as PurchaseOrder[], supabase)
}

export async function getPurchaseOrdersAll(): Promise<PurchaseOrder[]> {
  const { supabase, studioId } = await getAuthContext()
  const { data, error } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("*")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return mergePOVendors((data ?? []) as PurchaseOrder[], supabase)
}

export async function createPurchaseOrder(input: CreatePOInput): Promise<PurchaseOrder> {
  const { supabase, studioId, userId, role } = await getAuthContext()

  if (role === 'designer' || role === 'intern') {
    throw new Error("Only owners and senior designers can create purchase orders")
  }

  const [{ data: studio }, { data: vendor }] = await Promise.all([
    (supabase.from as AnyQuery)("studios").select("name, po_approval_threshold").eq("id", studioId).single(),
    (supabase.from as AnyQuery)("vendors").select("name, whatsapp_number").eq("id", input.vendor_id).single(),
  ])

  if (!studio) throw new Error("Studio not found")
  if (!vendor) throw new Error("Vendor not found")

  const { lineItems, subtotal, gstTotal, grandTotal } = computeLineItems(input.line_items)
  const poNumber = await generatePONumber(studioId, (studio as Record<string, unknown>).name as string, supabase)
  const threshold = ((studio as Record<string, unknown>).po_approval_threshold as number) ?? 0
  const status = grandTotal >= threshold ? 'pending_approval' : 'approved'

  const { data, error } = await (supabase.from as AnyQuery)("purchase_orders")
    .insert({
      studio_id: studioId,
      project_id: input.project_id,
      vendor_id: input.vendor_id,
      po_number: poNumber,
      po_date: new Date().toISOString().split('T')[0],
      line_items: lineItems,
      subtotal,
      gst_total: gstTotal,
      grand_total: grandTotal,
      delivery_address: input.delivery_address ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      payment_terms: input.payment_terms ?? {},
      special_instructions: input.special_instructions ?? null,
      status,
      created_by_id: userId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (status === 'pending_approval') {
    const { notifyPOApprovalRequired } = await import("./notifications")
    notifyPOApprovalRequired(studioId, poNumber, grandTotal).catch(() => {})
  }

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${input.project_id}`)

  const merged = await mergePOVendors([data as PurchaseOrder], supabase)
  return merged[0]
}

export async function updatePurchaseOrder(poId: string, updates: Partial<CreatePOInput>): Promise<PurchaseOrder> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("studio_id, status, project_id")
    .eq("id", poId)
    .single()
  if (!existing || (existing as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")
  if ((existing as Record<string, unknown>).status !== 'draft' && (existing as Record<string, unknown>).status !== 'pending_approval') {
    throw new Error("Only draft or pending approval POs can be updated")
  }

  const payload: Record<string, unknown> = {}
  if (updates.delivery_address !== undefined) payload.delivery_address = updates.delivery_address
  if (updates.expected_delivery_date !== undefined) payload.expected_delivery_date = updates.expected_delivery_date
  if (updates.payment_terms !== undefined) payload.payment_terms = updates.payment_terms
  if (updates.special_instructions !== undefined) payload.special_instructions = updates.special_instructions
  if (updates.vendor_id !== undefined) payload.vendor_id = updates.vendor_id

  if (updates.line_items) {
    const { lineItems, subtotal, gstTotal, grandTotal } = computeLineItems(updates.line_items)
    payload.line_items = lineItems
    payload.subtotal = subtotal
    payload.gst_total = gstTotal
    payload.grand_total = grandTotal
  }

  const { data, error } = await (supabase.from as AnyQuery)("purchase_orders")
    .update(payload)
    .eq("id", poId)
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${(existing as Record<string, unknown>).project_id}`)
  const merged = await mergePOVendors([data as PurchaseOrder], supabase)
  return merged[0]
}

export async function approvePurchaseOrder(poId: string): Promise<PurchaseOrder> {
  const { supabase, studioId, userId, role } = await getAuthContext()
  if (role !== 'owner') throw new Error("Only owners can approve purchase orders")

  const { data: existing } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("studio_id, status, project_id")
    .eq("id", poId)
    .single()
  if (!existing || (existing as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")
  if ((existing as Record<string, unknown>).status !== 'pending_approval') throw new Error("PO is not pending approval")

  const { data, error } = await (supabase.from as AnyQuery)("purchase_orders")
    .update({ status: 'approved', approved_by_id: userId, approved_at: new Date().toISOString() })
    .eq("id", poId)
    .select()
    .single()
  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${(existing as Record<string, unknown>).project_id}`)
  const merged = await mergePOVendors([data as PurchaseOrder], supabase)
  return merged[0]
}

export async function rejectPurchaseOrder(poId: string, reason: string): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()
  if (role !== 'owner') throw new Error("Only owners can reject purchase orders")

  const { data: existing } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("studio_id, project_id, special_instructions")
    .eq("id", poId)
    .single()
  if (!existing || (existing as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")

  const prevInstructions = (existing as Record<string, unknown>).special_instructions as string | null
  const newInstructions = prevInstructions
    ? `${prevInstructions}\n\nRejection reason: ${reason}`
    : `Rejection reason: ${reason}`

  const { error } = await (supabase.from as AnyQuery)("purchase_orders")
    .update({ status: 'draft', special_instructions: newInstructions })
    .eq("id", poId)
  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${(existing as Record<string, unknown>).project_id}`)
}

export async function sendPurchaseOrder(poId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("studio_id, status, project_id, vendor_id, po_number")
    .eq("id", poId)
    .single()
  if (!existing || (existing as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")
  if ((existing as Record<string, unknown>).status !== 'approved') throw new Error("Only approved POs can be sent")

  const { data: project } = await supabase.from("projects").select("name").eq("id", (existing as Record<string, unknown>).project_id as string).single()

  const { error } = await (supabase.from as AnyQuery)("purchase_orders")
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq("id", poId)
  if (error) throw new Error(error.message)

  const { notifyVendorPOSent } = await import("./notifications")
  notifyVendorPOSent(
    studioId,
    (existing as Record<string, unknown>).vendor_id as string,
    (existing as Record<string, unknown>).po_number as string,
    project?.name ?? ""
  ).catch(() => {})

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${(existing as Record<string, unknown>).project_id}`)
}

export async function deletePurchaseOrder(poId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await (supabase.from as AnyQuery)("purchase_orders")
    .select("studio_id, status, project_id")
    .eq("id", poId)
    .single()
  if (!existing || (existing as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")
  if (!['draft', 'pending_approval'].includes((existing as Record<string, unknown>).status as string)) {
    throw new Error("Cannot delete a sent or confirmed purchase order")
  }

  const { error } = await (supabase.from as AnyQuery)("purchase_orders").delete().eq("id", poId)
  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/vendors")
  revalidatePath(`/dashboard/projects/${(existing as Record<string, unknown>).project_id}`)
}
