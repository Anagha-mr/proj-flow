"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export interface QuoteRequest {
  id: string
  studio_id: string
  project_id: string
  procurement_item_id: string
  requested_by_id: string
  vendor_ids: string[]
  specifications: string | null
  required_lead_time_days: number | null
  min_order_qty: number | null
  logistics_notes: string | null
  response_deadline: string | null
  status: 'sent' | 'partially_responded' | 'fully_responded' | 'closed'
  created_at: string
  updated_at: string
  // merged
  item_name?: string
  responses?: QuoteResponse[]
  response_count?: number
}

export interface QuoteResponse {
  id: string
  studio_id: string
  quote_request_id: string
  vendor_id: string
  unit_price: number
  lead_time_days: number | null
  min_order_qty: number | null
  validity_date: string | null
  notes: string | null
  quote_document_url: string | null
  submitted_at: string
  is_selected: boolean
  created_at: string
  // merged
  vendor_name?: string
}

export type CreateQuoteRequestInput = {
  project_id: string
  procurement_item_id: string
  vendor_ids: string[]
  specifications?: string
  required_lead_time_days?: number
  min_order_qty?: number
  logistics_notes?: string
  response_deadline?: string
}

export type SubmitQuoteResponseInput = {
  quote_request_id: string
  vendor_id: string
  unit_price: number
  lead_time_days?: number
  min_order_qty?: number
  validity_date?: string
  notes?: string
  quote_document_url?: string
}

export async function getQuoteRequests(projectId: string): Promise<QuoteRequest[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: requests, error } = await (supabase.from as AnyQuery)("quote_requests")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  if (!requests || requests.length === 0) return []

  const requestIds = (requests as QuoteRequest[]).map((r) => r.id)
  const itemIds = [...new Set((requests as QuoteRequest[]).map((r) => r.procurement_item_id))]

  const [{ data: responses }, { data: items }] = await Promise.all([
    (supabase.from as AnyQuery)("quote_responses")
      .select("*")
      .in("quote_request_id", requestIds),
    supabase
      .from("procurement_items")
      .select("id, name")
      .in("id", itemIds),
  ])

  const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i.name]))

  const allVendorIds = [
    ...new Set([
      ...(requests as QuoteRequest[]).flatMap((r) => (r.vendor_ids as string[]) ?? []),
      ...((responses ?? []) as QuoteResponse[]).map((r) => r.vendor_id),
    ].filter(Boolean))
  ]
  const { data: vendors } = allVendorIds.length > 0
    ? await (supabase.from as AnyQuery)("vendors").select("id, name").in("id", allVendorIds)
    : { data: [] }
  const vendorMap = Object.fromEntries(
    ((vendors ?? []) as Array<Record<string, unknown>>).map((v) => [v.id, v.name])
  )

  const responsesByRequest: Record<string, QuoteResponse[]> = {}
  ;((responses ?? []) as QuoteResponse[]).forEach((resp) => {
    if (!responsesByRequest[resp.quote_request_id]) responsesByRequest[resp.quote_request_id] = []
    responsesByRequest[resp.quote_request_id].push({
      ...resp,
      vendor_name: (vendorMap[resp.vendor_id] as string) ?? undefined,
    })
  })

  return (requests as QuoteRequest[]).map((req) => ({
    ...req,
    item_name: itemMap[req.procurement_item_id] ?? undefined,
    responses: responsesByRequest[req.id] ?? [],
    response_count: (responsesByRequest[req.id] ?? []).length,
  }))
}

export async function createQuoteRequest(input: CreateQuoteRequestInput): Promise<QuoteRequest> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: item } = await supabase
    .from("procurement_items")
    .select("id, studio_id, name")
    .eq("id", input.procurement_item_id)
    .single()
  if (!item || item.studio_id !== studioId) throw new Error("Unauthorized")

  const { data, error } = await (supabase.from as AnyQuery)("quote_requests")
    .insert({
      studio_id: studioId,
      project_id: input.project_id,
      procurement_item_id: input.procurement_item_id,
      requested_by_id: userId,
      vendor_ids: input.vendor_ids,
      specifications: input.specifications ?? null,
      required_lead_time_days: input.required_lead_time_days ?? null,
      min_order_qty: input.min_order_qty ?? null,
      logistics_notes: input.logistics_notes ?? null,
      response_deadline: input.response_deadline ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const { notifyVendorQuoteRequest } = await import("./notifications")
  for (const vendorId of input.vendor_ids) {
    notifyVendorQuoteRequest(
      studioId,
      vendorId,
      item.name,
      input.response_deadline ?? ""
    ).catch(() => {})
  }

  revalidatePath(`/dashboard/projects/${input.project_id}`)
  return data as QuoteRequest
}

export async function selectWinningQuote(quoteResponseId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: resp } = await (supabase.from as AnyQuery)("quote_responses")
    .select("id, studio_id, quote_request_id, vendor_id, unit_price")
    .eq("id", quoteResponseId)
    .single()
  if (!resp || (resp as Record<string, unknown>).studio_id !== studioId) throw new Error("Unauthorized")

  const { data: qr } = await (supabase.from as AnyQuery)("quote_requests")
    .select("id, procurement_item_id, project_id, vendor_ids")
    .eq("id", (resp as Record<string, unknown>).quote_request_id)
    .single()
  if (!qr) throw new Error("Quote request not found")

  await (supabase.from as AnyQuery)("quote_responses")
    .update({ is_selected: true })
    .eq("id", quoteResponseId)

  await (supabase.from as AnyQuery)("quote_responses")
    .update({ is_selected: false })
    .eq("quote_request_id", (resp as Record<string, unknown>).quote_request_id)
    .neq("id", quoteResponseId)

  await supabase
    .from("procurement_items")
    .update({ unit_cost: (resp as Record<string, unknown>).unit_price as number })
    .eq("id", (qr as Record<string, unknown>).procurement_item_id as string)

  await supabase
    .from("procurement_item_status")
    .update({ curation_status: 'internally_approved' })
    .eq("item_id", (qr as Record<string, unknown>).procurement_item_id as string)

  await (supabase.from as AnyQuery)("quote_requests")
    .update({ status: 'closed' })
    .eq("id", (resp as Record<string, unknown>).quote_request_id)

  const { notifyVendorQuoteNotSelected } = await import("./notifications")
  const { data: itemRow } = await supabase
    .from("procurement_items")
    .select("name")
    .eq("id", (qr as Record<string, unknown>).procurement_item_id as string)
    .single()
  const itemName = itemRow?.name ?? "Item"

  const { data: nonSelected } = await (supabase.from as AnyQuery)("quote_responses")
    .select("vendor_id")
    .eq("quote_request_id", (resp as Record<string, unknown>).quote_request_id)
    .neq("id", quoteResponseId)

  for (const ns of (nonSelected ?? []) as Array<Record<string, unknown>>) {
    notifyVendorQuoteNotSelected(studioId, ns.vendor_id as string, itemName).catch(() => {})
  }

  revalidatePath(`/dashboard/projects/${(qr as Record<string, unknown>).project_id}`)
}

// No auth — called from public API route
export async function submitQuoteResponse(input: SubmitQuoteResponseInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: qr, error: qrErr } = await supabase
    .from("quote_requests")
    .select("id, studio_id, vendor_ids, status, procurement_item_id, project_id")
    .eq("id", input.quote_request_id)
    .single()
  if (qrErr || !qr) throw new Error("Quote request not found")
  if (qr.status === 'closed') throw new Error("Quote request is closed")

  const { error: upsertErr } = await supabase
    .from("quote_responses")
    .upsert(
      {
        studio_id: qr.studio_id,
        quote_request_id: input.quote_request_id,
        vendor_id: input.vendor_id,
        unit_price: input.unit_price,
        lead_time_days: input.lead_time_days ?? null,
        min_order_qty: input.min_order_qty ?? null,
        validity_date: input.validity_date ?? null,
        notes: input.notes ?? null,
        quote_document_url: input.quote_document_url ?? null,
        submitted_at: new Date().toISOString(),
        is_selected: false,
      },
      { onConflict: "quote_request_id,vendor_id" }
    )
  if (upsertErr) throw new Error(upsertErr.message)

  const { data: responses } = await supabase
    .from("quote_responses")
    .select("vendor_id")
    .eq("quote_request_id", input.quote_request_id)

  const respondedVendors = new Set((responses ?? []).map((r: Record<string, unknown>) => r.vendor_id))
  const allVendors = (qr.vendor_ids as string[]) ?? []
  const allResponded = allVendors.every((vid) => respondedVendors.has(vid))
  const newStatus = allResponded ? 'fully_responded' : 'partially_responded'

  await supabase
    .from("quote_requests")
    .update({ status: newStatus })
    .eq("id", input.quote_request_id)

  const { data: vendor } = await supabase
    .from("vendors")
    .select("name")
    .eq("id", input.vendor_id)
    .single()
  const { data: item } = await supabase
    .from("procurement_items")
    .select("name")
    .eq("id", qr.procurement_item_id)
    .single()

  const { notifyQuoteResponseReceived } = await import("./notifications")
  notifyQuoteResponseReceived(
    qr.studio_id,
    qr.project_id ?? "",
    item?.name ?? "Item",
    vendor?.name ?? "Vendor"
  ).catch(() => {})
}
