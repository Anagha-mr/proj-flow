"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

export interface StagePayment {
  id: string
  studio_id: string
  project_id: string
  contractor_id: string
  milestone_name: string
  milestone_description: string | null
  amount: number
  expected_date: string | null
  status: "pending" | "released" | "received"
  released_at: string | null
  released_by_id: string | null
  received_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  contractor?: { company_name: string; contact_name: string }
  released_by?: { name: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export async function getStagePayments(projectId: string): Promise<StagePayment[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: payments, error } = await (supabase.from as AnyQuery)("stage_payments")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("expected_date", { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)
  const rows = (payments ?? []) as StagePayment[]

  const contractorIds = [...new Set(rows.map((p) => p.contractor_id))]
  const releaserIds = [...new Set(rows.map((p) => p.released_by_id).filter(Boolean))] as string[]

  const contractorMap: Record<string, { company_name: string; contact_name: string }> = {}
  if (contractorIds.length > 0) {
    const { data: contractors } = await supabase
      .from("contractors")
      .select("id, company_name, contact_name")
      .in("id", contractorIds)
    ;(contractors ?? []).forEach((c) => {
      contractorMap[c.id] = { company_name: c.company_name, contact_name: c.contact_name }
    })
  }

  const releaserMap: Record<string, { name: string }> = {}
  if (releaserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", releaserIds)
    ;(users ?? []).forEach((u) => { releaserMap[u.id] = { name: u.name } })
  }

  return rows.map((p) => ({
    ...p,
    contractor: contractorMap[p.contractor_id],
    released_by: p.released_by_id ? releaserMap[p.released_by_id] : undefined,
  }))
}

export async function createStagePayment(input: {
  projectId: string
  contractorId: string
  milestoneName: string
  milestoneDescription?: string
  amount: number
  expectedDate?: string
  notes?: string
}): Promise<StagePayment> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id")
    .eq("id", input.contractorId)
    .eq("studio_id", studioId)
    .single()
  if (!contractor) throw new Error("Contractor not found")

  const { data, error } = await (supabase.from as AnyQuery)("stage_payments")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      contractor_id: input.contractorId,
      milestone_name: input.milestoneName,
      milestone_description: input.milestoneDescription ?? null,
      amount: input.amount,
      expected_date: input.expectedDate ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as StagePayment
}

export async function releasePayment(paymentId: string): Promise<void> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: payment } = await (supabase.from as AnyQuery)("stage_payments")
    .select("status, project_id")
    .eq("id", paymentId)
    .eq("studio_id", studioId)
    .single()
  if (!payment) throw new Error("Payment not found")
  if (payment.status !== "pending") throw new Error("Only pending payments can be released")

  const { error } = await (supabase.from as AnyQuery)("stage_payments")
    .update({
      status: "released",
      released_at: new Date().toISOString(),
      released_by_id: userId,
    })
    .eq("id", paymentId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)

  import("./notifications").then(({ notifyStagePaymentReleased }) => {
    notifyStagePaymentReleased(paymentId).catch(() => {})
  }).catch(() => {})

  revalidatePath(`/dashboard/projects/${payment.project_id}`)
}

export async function confirmPaymentReceived(paymentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: payment } = await (supabase.from as AnyQuery)("stage_payments")
    .select("status, project_id")
    .eq("id", paymentId)
    .eq("studio_id", studioId)
    .single()
  if (!payment) throw new Error("Payment not found")
  if (payment.status !== "released") throw new Error("Payment must be released before confirming receipt")

  const { error } = await (supabase.from as AnyQuery)("stage_payments")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${payment.project_id}`)
}

export async function deleteStagePayment(paymentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: payment } = await (supabase.from as AnyQuery)("stage_payments")
    .select("status, project_id")
    .eq("id", paymentId)
    .eq("studio_id", studioId)
    .single()
  if (!payment) throw new Error("Payment not found")
  if (payment.status !== "pending") throw new Error("Only pending payments can be deleted")

  const { error } = await (supabase.from as AnyQuery)("stage_payments")
    .delete()
    .eq("id", paymentId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${payment.project_id}`)
}
