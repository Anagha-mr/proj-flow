"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export interface Vendor {
  id: string
  studio_id: string
  name: string
  type: 'furniture' | 'tiles' | 'lighting' | 'textiles' | 'sanitaryware' | 'hardware' | 'other'
  type_custom: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  whatsapp_number: string | null
  showroom_address: string | null
  gstin: string | null
  bank_details: { account_number: string; ifsc: string; bank_name: string; account_name: string } | null
  preferred_categories: string[]
  default_lead_time_days: number | null
  rating_by_category: Record<string, number>
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type CreateVendorInput = Omit<Vendor,
  'id' | 'studio_id' | 'rating_by_category' | 'is_active' | 'created_at' | 'updated_at'
>

export async function getVendors(): Promise<Vendor[]> {
  const { supabase, studioId } = await getAuthContext()
  const { data, error } = await (supabase.from as AnyQuery)("vendors")
    .select("*")
    .eq("studio_id", studioId)
    .order("name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Vendor[]
}

export async function getVendorById(vendorId: string): Promise<Vendor> {
  const { supabase, studioId } = await getAuthContext()
  const { data, error } = await (supabase.from as AnyQuery)("vendors")
    .select("*")
    .eq("id", vendorId)
    .single()
  if (error) throw new Error(error.message)
  if ((data as Vendor).studio_id !== studioId) throw new Error("Unauthorized")
  return data as Vendor
}

export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  const { supabase, studioId } = await getAuthContext()
  if (!input.name?.trim()) throw new Error("Vendor name is required")
  if (!input.type) throw new Error("Vendor type is required")

  const { data, error } = await (supabase.from as AnyQuery)("vendors")
    .insert({ ...input, studio_id: studioId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/vendors")
  return data as Vendor
}

export async function updateVendor(vendorId: string, updates: Partial<CreateVendorInput>): Promise<Vendor> {
  const { supabase, studioId } = await getAuthContext()
  const { data: existing } = await (supabase.from as AnyQuery)("vendors")
    .select("studio_id")
    .eq("id", vendorId)
    .single()
  if (!existing || (existing as Vendor).studio_id !== studioId) throw new Error("Unauthorized")

  const { data, error } = await (supabase.from as AnyQuery)("vendors")
    .update(updates)
    .eq("id", vendorId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/vendors")
  return data as Vendor
}

export async function deactivateVendor(vendorId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const { data: existing } = await (supabase.from as AnyQuery)("vendors")
    .select("studio_id")
    .eq("id", vendorId)
    .single()
  if (!existing || (existing as Vendor).studio_id !== studioId) throw new Error("Unauthorized")

  const { error } = await (supabase.from as AnyQuery)("vendors")
    .update({ is_active: false })
    .eq("id", vendorId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/vendors")
}

export async function getVendorProcurementItems(vendorId: string): Promise<Array<{
  id: string; name: string; project_name: string; total_cost: number | null; curation_status: string | null
}>> {
  const { supabase, studioId } = await getAuthContext()
  const { data: items, error } = await supabase
    .from("procurement_items")
    .select("id, name, total_cost, project_id")
    .eq("studio_id", studioId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("supplier_id" as any, vendorId)
  if (error) return []

  if (!items || items.length === 0) return []

  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))]
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("id", projectIds as string[])
  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]))

  const itemIds = items.map((i) => i.id)
  const { data: statuses } = await supabase
    .from("procurement_item_status")
    .select("item_id, curation_status")
    .in("item_id", itemIds)
  const statusMap = Object.fromEntries((statuses ?? []).map((s) => [s.item_id, s.curation_status]))

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    project_name: projectMap[i.project_id ?? ""] ?? "—",
    total_cost: i.total_cost ?? null,
    curation_status: statusMap[i.id] ?? null,
  }))
}

export async function getVendorQuoteResponses(vendorId: string): Promise<Array<{
  id: string; item_name: string; unit_price: number; submitted_at: string; is_selected: boolean
}>> {
  const { supabase, studioId } = await getAuthContext()
  const { data: responses, error } = await (supabase.from as AnyQuery)("quote_responses")
    .select("id, quote_request_id, unit_price, submitted_at, is_selected")
    .eq("studio_id", studioId)
    .eq("vendor_id", vendorId)
    .order("submitted_at", { ascending: false })
  if (error || !responses || responses.length === 0) return []

  const requestIds = [...new Set((responses as Array<Record<string, unknown>>).map((r) => r.quote_request_id as string))]
  const { data: requests } = await (supabase.from as AnyQuery)("quote_requests")
    .select("id, procurement_item_id")
    .in("id", requestIds)
  const requestMap = Object.fromEntries(
    ((requests ?? []) as Array<Record<string, unknown>>).map((r) => [r.id, r.procurement_item_id])
  )

  const itemIds = [...new Set(Object.values(requestMap).filter(Boolean))]
  const { data: items } = await supabase
    .from("procurement_items")
    .select("id, name")
    .in("id", itemIds as string[])
  const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i.name]))

  return (responses as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    item_name: itemMap[requestMap[r.quote_request_id as string] as string ?? ""] ?? "—",
    unit_price: r.unit_price as number,
    submitted_at: r.submitted_at as string,
    is_selected: r.is_selected as boolean,
  }))
}
