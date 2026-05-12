"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { getScheduleSummary } from "./procurement"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"
import { computeGst } from "@/lib/gst"

type SupabaseClientType = Awaited<ReturnType<typeof createClient>>

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string
  description: string
  hsn_code: string
  amount: number
  gst_rate: number
  cgst: number
  sgst: number
  igst: number
}

export interface Invoice {
  id: string
  studio_id: string
  project_id: string
  client_id: string
  invoice_number: string
  line_items: LineItem[]
  subtotal: number
  gst_amount: number
  total: number
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
  issue_date: string
  due_date: string | null
  sent_at: string | null
  reminder_sent_at: string[] | null
  notes: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
  client?: { name: string; email: string | null; state_code: string | null; whatsapp_number: string | null }
  payments?: InvoicePayment[]
  amount_paid?: number
  amount_due?: number
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  studio_id: string
  amount: number
  payment_date: string
  bank_reference: string | null
  notes: string | null
  recorded_by_id: string | null
  created_at: string
  recorder?: { name: string }
}

export interface ExpenseEntry {
  id: string
  studio_id: string
  project_id: string
  category: 'procurement' | 'contractor' | 'vendor_payment' | 'consultant_fee' | 'site_expense' | 'other'
  description: string
  amount: number
  expense_date: string
  reference: string | null
  recorded_by_id: string | null
  created_at: string
}

export interface ProjectFinanceSummary {
  contract_value: number | null
  total_invoiced: number
  total_collected: number
  total_outstanding: number
  procurement_cost: number
  expense_total: number
  total_cost: number
  gross_margin: number
  overdue_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateInvoiceNumber(
  studioId: string,
  studioName: string,
  supabase: SupabaseClientType
): Promise<string> {
  const prefix = studioName.slice(0, 2).toUpperCase()
  const year = new Date().getFullYear()
  const pattern = `${prefix}-${year}-%`

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .like("invoice_number", pattern)

  const seq = ((count ?? 0) + 1).toString().padStart(4, "0")
  return `${prefix}-${year}-${seq}`
}

// ─── getInvoices ──────────────────────────────────────────────────────────────

export async function getInvoices(projectId: string): Promise<Invoice[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  if (!invoices || invoices.length === 0) return []

  // Fetch clients separately
  const clientIds = [...new Set(invoices.map((i) => i.client_id))]
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, state_code, whatsapp_number")
    .in("id", clientIds)
  const clientMap: Record<string, { name: string; email: string | null; state_code: string | null; whatsapp_number: string | null }> = {}
  ;(clients ?? []).forEach((c) => { clientMap[c.id] = c })

  // Fetch payments separately
  const invoiceIds = invoices.map((i) => i.id)
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("*")
    .in("invoice_id", invoiceIds)
    .eq("studio_id", studioId)

  const paymentsMap: Record<string, InvoicePayment[]> = {}
  ;(payments ?? []).forEach((p) => {
    if (!paymentsMap[p.invoice_id]) paymentsMap[p.invoice_id] = []
    paymentsMap[p.invoice_id].push(p as unknown as InvoicePayment)
  })

  const result: Invoice[] = invoices.map((inv) => {
    const invPayments = paymentsMap[inv.id] ?? []
    const amount_paid = invPayments.reduce((sum, p) => sum + p.amount, 0)
    return {
      ...(inv as unknown as Invoice),
      client: clientMap[inv.client_id],
      payments: invPayments,
      amount_paid,
      amount_due: inv.total - amount_paid,
    }
  })

  // Sort: draft first, then by issue_date DESC
  return result.sort((a, b) => {
    if (a.status === "draft" && b.status !== "draft") return -1
    if (a.status !== "draft" && b.status === "draft") return 1
    return new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
  })
}

// ─── createInvoice ────────────────────────────────────────────────────────────

export async function createInvoice(input: {
  projectId: string
  clientId: string
  dueDate?: string
  notes?: string
}): Promise<Invoice> {
  if (!input.clientId) throw new Error("A client must be selected before creating an invoice")
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: studio } = await supabase
    .from("studios")
    .select("name, state_code, gstin, bank_details")
    .eq("id", studioId)
    .single()
  if (!studio) throw new Error("Studio not found")

  const invoiceNumber = await generateInvoiceNumber(studioId, studio.name, supabase)

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      client_id: input.clientId,
      invoice_number: invoiceNumber,
      line_items: [],
      subtotal: 0,
      gst_amount: 0,
      total: 0,
      status: "draft",
      due_date: input.dueDate ?? null,
      notes: input.notes ?? null,
      created_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return invoice as unknown as Invoice
}

// ─── updateInvoice ────────────────────────────────────────────────────────────

export async function updateInvoice(
  invoiceId: string,
  updates: {
    lineItems?: LineItem[]
    dueDate?: string
    notes?: string
    issueDate?: string
  }
): Promise<Invoice> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")

  let patchLineItems: Json | undefined
  let patchSubtotal: number | undefined
  let patchGstAmount: number | undefined
  let patchTotal: number | undefined

  if (updates.lineItems !== undefined) {
    const lineItems = updates.lineItems
    patchSubtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
    patchGstAmount = lineItems.reduce(
      (sum, item) => sum + item.cgst + item.sgst + item.igst,
      0
    )
    patchTotal = patchSubtotal + patchGstAmount
    patchLineItems = lineItems as unknown as Json
  }

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({
      ...(patchLineItems !== undefined && {
        line_items: patchLineItems,
        subtotal: patchSubtotal,
        gst_amount: patchGstAmount,
        total: patchTotal,
      }),
      ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.issueDate !== undefined && { issue_date: updates.issueDate }),
    })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${invoice.project_id}`)
  return updated as unknown as Invoice
}

// ─── sendInvoice ──────────────────────────────────────────────────────────────

export async function sendInvoice(invoiceId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")
  if (invoice.status !== "draft") throw new Error("Only draft invoices can be sent")

  const { data: client } = await supabase
    .from("clients")
    .select("name, email, whatsapp_number")
    .eq("id", invoice.client_id)
    .single()

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", invoice.project_id)
    .single()

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  // Stub: log to whatsapp_messages table
  await supabase.from("whatsapp_messages").insert({
    studio_id: studioId,
    recipient_type: "client",
    recipient_id: invoice.client_id,
    template_id: "invoice_sent",
    variables: {
      name: client?.name ?? "",
      invoice_number: invoice.invoice_number,
      amount: invoice.total,
      due_date: invoice.due_date ?? "",
      project_name: project?.name ?? "",
    },
    status: "queued",
    project_id: invoice.project_id,
  })

  console.log("EMAIL: invoice sent to", client?.email)

  revalidatePath(`/dashboard/projects/${invoice.project_id}`)
}

// ─── recordPayment ────────────────────────────────────────────────────────────

export async function recordPayment(input: {
  invoiceId: string
  amount: number
  paymentDate: string
  bankReference?: string
  notes?: string
}): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", input.invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")
  if (invoice.status === "draft") throw new Error("Cannot record payment on a draft invoice")

  await supabase.from("invoice_payments").insert({
    invoice_id: input.invoiceId,
    studio_id: studioId,
    amount: input.amount,
    payment_date: input.paymentDate,
    bank_reference: input.bankReference ?? null,
    notes: input.notes ?? null,
    recorded_by_id: userId,
  })

  await recalculateInvoiceStatus(invoice.id, invoice.total, studioId, supabase)

  revalidatePath(`/dashboard/projects/${invoice.project_id}`)
}

// ─── deletePayment ────────────────────────────────────────────────────────────

export async function deletePayment(paymentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: payment } = await supabase
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", paymentId)
    .eq("studio_id", studioId)
    .single()
  if (!payment) throw new Error("Payment not found")

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total, project_id")
    .eq("id", payment.invoice_id)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")

  await supabase
    .from("invoice_payments")
    .delete()
    .eq("id", paymentId)
    .eq("studio_id", studioId)

  await recalculateInvoiceStatus(invoice.id, invoice.total, studioId, supabase)

  revalidatePath(`/dashboard/projects/${invoice.project_id}`)
}

// ─── Internal: recalculate invoice status ─────────────────────────────────────

async function recalculateInvoiceStatus(
  invoiceId: string,
  invoiceTotal: number,
  studioId: string,
  supabase: SupabaseClientType
): Promise<void> {
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("studio_id", studioId)

  const sum = (payments ?? []).reduce((acc, p) => acc + p.amount, 0)

  let newStatus: string
  if (sum >= invoiceTotal) {
    newStatus = "paid"
  } else if (sum > 0) {
    newStatus = "partial"
  } else {
    newStatus = "sent"
  }

  await supabase
    .from("invoices")
    .update({ status: newStatus })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
}

// ─── markOverdue ──────────────────────────────────────────────────────────────

export async function markOverdue(projectId: string): Promise<number> {
  const { supabase, studioId } = await getAuthContext()

  const today = new Date().toISOString().split("T")[0]

  const { data: staleInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .in("status", ["sent", "partial"])
    .lt("due_date", today)
    .not("due_date", "is", null)

  if (!staleInvoices || staleInvoices.length === 0) return 0

  const ids = staleInvoices.map((i) => i.id)
  await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in("id", ids)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${projectId}`)
  return ids.length
}

// ─── deleteInvoice ────────────────────────────────────────────────────────────

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, project_id")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")
  if (invoice.status !== "draft") throw new Error("Only draft invoices can be deleted")

  await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${invoice.project_id}`)
}

// ─── createExpense ────────────────────────────────────────────────────────────

export async function createExpense(input: {
  projectId: string
  category: ExpenseEntry["category"]
  description: string
  amount: number
  expenseDate?: string
  reference?: string
}): Promise<ExpenseEntry> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: expense, error } = await supabase
    .from("expense_entries")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      expense_date: input.expenseDate ?? new Date().toISOString().split("T")[0],
      reference: input.reference ?? null,
      recorded_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return expense as ExpenseEntry
}

// ─── updateExpense ────────────────────────────────────────────────────────────

export async function updateExpense(
  expenseId: string,
  updates: Partial<Pick<ExpenseEntry, "description" | "amount" | "expense_date" | "category" | "reference">>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: expense } = await supabase
    .from("expense_entries")
    .select("project_id")
    .eq("id", expenseId)
    .eq("studio_id", studioId)
    .single()
  if (!expense) throw new Error("Expense not found")

  await supabase
    .from("expense_entries")
    .update(updates)
    .eq("id", expenseId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${expense.project_id}`)
}

// ─── deleteExpense ────────────────────────────────────────────────────────────

export async function deleteExpense(expenseId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: expense } = await supabase
    .from("expense_entries")
    .select("project_id")
    .eq("id", expenseId)
    .eq("studio_id", studioId)
    .single()
  if (!expense) throw new Error("Expense not found")

  await supabase
    .from("expense_entries")
    .delete()
    .eq("id", expenseId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${expense.project_id}`)
}

// ─── getExpenses ──────────────────────────────────────────────────────────────

export async function getExpenses(projectId: string): Promise<ExpenseEntry[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("expense_entries")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("expense_date", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExpenseEntry[]
}

// ─── getProjectFinanceSummary ─────────────────────────────────────────────────

export async function getProjectFinanceSummary(projectId: string): Promise<ProjectFinanceSummary> {
  const { supabase, studioId } = await getAuthContext()

  // Procurement cost from Sprint 5
  const procurementSummary = await getScheduleSummary(projectId)

  // Project contract value
  const { data: project } = await supabase
    .from("projects")
    .select("gst_bracket")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  const contract_value = project?.gst_bracket ? parseFloat(project.gst_bracket) || null : null

  // Invoices aggregation
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, total, status")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  const invoiceIds = (invoices ?? []).map((i) => i.id)
  const paymentsQuery = invoiceIds.length > 0
    ? await supabase.from("invoice_payments").select("amount").eq("studio_id", studioId).in("invoice_id", invoiceIds)
    : { data: [] }
  const payments = paymentsQuery.data

  let total_invoiced = 0
  let overdue_count = 0
  ;(invoices ?? []).forEach((inv) => {
    if (inv.status !== "draft") total_invoiced += inv.total
    if (inv.status === "overdue") overdue_count++
  })

  const total_collected = (payments ?? []).reduce((sum, p) => sum + p.amount, 0)

  // Expenses aggregation
  const { data: expenses } = await supabase
    .from("expense_entries")
    .select("amount")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  const expense_total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0)
  const procurement_cost = procurementSummary.approvedCost
  const total_cost = procurement_cost + expense_total
  const total_outstanding = total_invoiced - total_collected
  const gross_margin = total_collected - total_cost

  return {
    contract_value,
    total_invoiced,
    total_collected,
    total_outstanding,
    procurement_cost,
    expense_total,
    total_cost,
    gross_margin,
    overdue_count,
  }
}

// ─── getInvoiceForClient ──────────────────────────────────────────────────────

export async function getInvoiceForClient(
  invoiceId: string,
  portalToken: string
): Promise<Invoice | null> {
  const supabase = await createClient()

  // Validate portal token
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("portal_token", portalToken)
    .single()
  if (!client) return null

  // Verify invoice belongs to this client
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("client_id", client.id)
    .single()
  if (!invoice) return null

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("id, invoice_id, studio_id, amount, payment_date, bank_reference, created_at")
    .eq("invoice_id", invoiceId)

  const amount_paid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0)

  return {
    ...(invoice as unknown as Invoice),
    payments: (payments ?? []).map((p) => ({
      ...p,
      notes: null,
      recorded_by_id: null,
    })),
    amount_paid,
    amount_due: (invoice as unknown as Invoice).total - amount_paid,
  }
}
