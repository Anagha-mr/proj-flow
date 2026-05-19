"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudioExpense {
  id: string
  studio_id: string
  category: 'rent' | 'salaries' | 'software' | 'marketing' | 'utilities' | 'equipment' | 'professional_fees' | 'travel' | 'other'
  description: string
  amount: number
  expense_date: string
  reference: string | null
  is_recurring: boolean
  recurrence: 'monthly' | 'quarterly' | 'annual' | null
  recorded_by_id: string | null
  created_at: string
  updated_at: string
}

export interface ProjectPLRow {
  project_id: string
  project_name: string
  client_name: string
  status: string
  contract_value: number | null
  total_invoiced: number
  total_collected: number
  procurement_cost: number
  contractor_payments: number
  time_cost: number
  other_expenses: number
  total_cost: number
  gross_margin: number
  margin_percent: number | null
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  project_costs: number
  studio_expenses: number
}

export interface CategoryBreakdown {
  category: string
  amount: number
  percent: number
}

export interface StudioPLSummary {
  period_label: string
  total_revenue: number
  total_project_costs: number
  total_studio_expenses: number
  gross_profit: number
  net_profit: number
  gross_margin_percent: number | null
  net_margin_percent: number | null
  revenue_by_month: MonthlyRevenue[]
  expenses_by_category: CategoryBreakdown[]
  top_projects: ProjectPLRow[]
}

export interface GSTSummary {
  period_label: string
  output_tax_collected: number
  cgst_collected: number
  sgst_collected: number
  igst_collected: number
  input_tax_paid: number
  net_gst_liability: number
  invoice_count: number
}

// ─── Period resolution helper ─────────────────────────────────────────────────

function resolvePeriod(period: {
  type: 'monthly' | 'quarterly' | 'annual' | 'custom'
  year?: number
  quarter?: number
  month?: number
  from?: string
  to?: string
}): { from: string; to: string; label: string } {
  const y = period.year ?? new Date().getFullYear()

  if (period.type === 'custom' && period.from && period.to) {
    return { from: period.from, to: period.to, label: `${period.from} – ${period.to}` }
  }

  if (period.type === 'annual') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jan ${y} – Dec ${y}` }
  }

  if (period.type === 'quarterly') {
    const q = period.quarter ?? 1
    const ranges: Record<number, { from: string; to: string; label: string }> = {
      1: { from: `${y}-01-01`, to: `${y}-03-31`, label: `Q1 ${y}` },
      2: { from: `${y}-04-01`, to: `${y}-06-30`, label: `Q2 ${y}` },
      3: { from: `${y}-07-01`, to: `${y}-09-30`, label: `Q3 ${y}` },
      4: { from: `${y}-10-01`, to: `${y}-12-31`, label: `Q4 ${y}` },
    }
    return ranges[q] ?? ranges[1]
  }

  if (period.type === 'monthly') {
    const m = period.month ?? (new Date().getMonth() + 1)
    const mm = m.toString().padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate()
    const monthName = new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${lastDay}`, label: `${monthName} ${y}` }
  }

  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jan ${y} – Dec ${y}` }
}

// ─── getStudioExpenses ────────────────────────────────────────────────────────

export async function getStudioExpenses(
  filters?: { from?: string; to?: string; category?: string }
): Promise<StudioExpense[]> {
  const { supabase, studioId } = await getAuthContext()

  let query = (supabase.from as AnyQuery)('studio_expenses')
    .select('*')
    .eq('studio_id', studioId)
    .order('expense_date', { ascending: false })

  if (filters?.from) query = query.gte('expense_date', filters.from)
  if (filters?.to) query = query.lte('expense_date', filters.to)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as StudioExpense[]
}

// ─── createStudioExpense ──────────────────────────────────────────────────────

export async function createStudioExpense(
  input: Omit<StudioExpense, 'id' | 'studio_id' | 'recorded_by_id' | 'created_at' | 'updated_at'>
): Promise<StudioExpense> {
  const { supabase, studioId, userId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') {
    throw new Error('Only owners and senior designers can record studio expenses')
  }

  const { data, error } = await (supabase.from as AnyQuery)('studio_expenses')
    .insert({
      studio_id: studioId,
      recorded_by_id: userId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      expense_date: input.expense_date,
      reference: input.reference ?? null,
      is_recurring: input.is_recurring,
      recurrence: input.recurrence ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/finance')
  return data as StudioExpense
}

// ─── updateStudioExpense ──────────────────────────────────────────────────────

export async function updateStudioExpense(
  expenseId: string,
  updates: Partial<Omit<StudioExpense, 'id' | 'studio_id' | 'recorded_by_id' | 'created_at' | 'updated_at'>>
): Promise<StudioExpense> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') {
    throw new Error('Only owners and senior designers can update studio expenses')
  }

  const { data: existing } = await (supabase.from as AnyQuery)('studio_expenses')
    .select('studio_id')
    .eq('id', expenseId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error('Expense not found')

  const { data, error } = await (supabase.from as AnyQuery)('studio_expenses')
    .update(updates)
    .eq('id', expenseId)
    .eq('studio_id', studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/finance')
  return data as StudioExpense
}

// ─── deleteStudioExpense ──────────────────────────────────────────────────────

export async function deleteStudioExpense(expenseId: string): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner') throw new Error('Only studio owners can delete studio expenses')

  const { data: existing } = await (supabase.from as AnyQuery)('studio_expenses')
    .select('studio_id')
    .eq('id', expenseId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error('Expense not found')

  const { error } = await (supabase.from as AnyQuery)('studio_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('studio_id', studioId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/finance')
}

// ─── getProjectPLRows ─────────────────────────────────────────────────────────

export async function getProjectPLRows(
  filters?: { from?: string; to?: string; status?: string }
): Promise<ProjectPLRow[]> {
  const { supabase, studioId } = await getAuthContext()

  let projectQuery = (supabase.from as AnyQuery)('projects')
    .select('id, name, client_id, status, contract_value')
    .eq('studio_id', studioId)

  if (filters?.status) projectQuery = projectQuery.eq('status', filters.status)

  const { data: projects, error: projectsError } = await projectQuery
  if (projectsError) throw new Error(projectsError.message)
  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p: { id: string }) => p.id)
  const clientIds = [...new Set(
    projects.map((p: { client_id: string | null }) => p.client_id).filter(Boolean)
  )] as string[]

  // Batch all sub-queries in parallel
  const [
    invoicesResult,
    invoiceIdsResult,
    procItemsResult,
    procStatusResult,
    stagePaymentsResult,
    timeEntriesResult,
    expensesResult,
    clientsResult,
  ] = await Promise.all([
    // total_invoiced
    supabase
      .from('invoices')
      .select('project_id, total, status')
      .in('project_id', projectIds)
      .eq('studio_id', studioId)
      .neq('status', 'draft'),

    // invoice IDs for payments lookup
    supabase
      .from('invoices')
      .select('id, project_id')
      .in('project_id', projectIds)
      .eq('studio_id', studioId),

    // procurement items
    supabase
      .from('procurement_items')
      .select('id, project_id, total_cost')
      .in('project_id', projectIds)
      .eq('studio_id', studioId),

    // procurement statuses
    supabase
      .from('procurement_item_status')
      .select('item_id, curation_status'),

    // stage_payments received
    (supabase.from as AnyQuery)('stage_payments')
      .select('project_id, amount, status')
      .in('project_id', projectIds)
      .eq('studio_id', studioId)
      .eq('status', 'received'),

    // time_entries
    (supabase.from as AnyQuery)('time_entries')
      .select('project_id, hours, hourly_rate_snapshot')
      .in('project_id', projectIds)
      .eq('studio_id', studioId),

    // expense_entries
    supabase
      .from('expense_entries')
      .select('project_id, amount')
      .in('project_id', projectIds)
      .eq('studio_id', studioId),

    // client names
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Fetch payments for all invoices
  const allInvoiceIds = (invoiceIdsResult.data ?? []).map((i: { id: string }) => i.id)
  const paymentsByInvoice: Record<string, number> = {}
  if (allInvoiceIds.length > 0) {
    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount')
      .in('invoice_id', allInvoiceIds)
      .eq('studio_id', studioId)
    ;(payments ?? []).forEach((p) => {
      paymentsByInvoice[p.invoice_id] = (paymentsByInvoice[p.invoice_id] ?? 0) + p.amount
    })
  }

  const approvedItemIds = new Set(
    ((procStatusResult.data ?? []) as Array<{ item_id: string; curation_status: string }>)
      .filter((s) => s.curation_status === 'internally_approved')
      .map((s) => s.item_id)
  )

  const clientMap: Record<string, string> = {}
  ;((clientsResult.data ?? []) as Array<{ id: string; name: string }>).forEach((c) => {
    clientMap[c.id] = c.name
  })

  const totals: Record<string, {
    total_invoiced: number; total_collected: number; procurement_cost: number
    contractor_payments: number; time_cost: number; other_expenses: number
  }> = {}
  for (const pid of projectIds) {
    totals[pid] = { total_invoiced: 0, total_collected: 0, procurement_cost: 0, contractor_payments: 0, time_cost: 0, other_expenses: 0 }
  }

  ;((invoicesResult.data ?? []) as Array<{ project_id: string; total: number }>).forEach((inv) => {
    if (totals[inv.project_id]) totals[inv.project_id].total_invoiced += inv.total
  })

  ;((invoiceIdsResult.data ?? []) as Array<{ id: string; project_id: string }>).forEach((inv) => {
    const paid = paymentsByInvoice[inv.id] ?? 0
    if (totals[inv.project_id]) totals[inv.project_id].total_collected += paid
  })

  ;((procItemsResult.data ?? []) as Array<{ id: string; project_id: string; total_cost: number }>).forEach((item) => {
    if (approvedItemIds.has(item.id) && totals[item.project_id]) {
      totals[item.project_id].procurement_cost += item.total_cost ?? 0
    }
  })

  ;((stagePaymentsResult.data ?? []) as Array<{ project_id: string; amount: number }>).forEach((sp) => {
    if (totals[sp.project_id]) totals[sp.project_id].contractor_payments += sp.amount
  })

  ;((timeEntriesResult.data ?? []) as Array<{ project_id: string; hours: number; hourly_rate_snapshot: number }>).forEach((te) => {
    if (totals[te.project_id]) {
      totals[te.project_id].time_cost += (te.hours ?? 0) * (te.hourly_rate_snapshot ?? 0)
    }
  })

  ;((expensesResult.data ?? []) as Array<{ project_id: string; amount: number }>).forEach((exp) => {
    if (totals[exp.project_id]) totals[exp.project_id].other_expenses += exp.amount
  })

  const rows: ProjectPLRow[] = (projects as Array<{
    id: string; name: string; client_id: string | null; status: string; contract_value: number | null
  }>).map((p) => {
    const t = totals[p.id]
    const total_cost = t.procurement_cost + t.contractor_payments + t.time_cost + t.other_expenses
    const gross_margin = t.total_collected - total_cost
    const margin_percent = t.total_collected > 0 ? (gross_margin / t.total_collected) * 100 : null

    return {
      project_id: p.id,
      project_name: p.name,
      client_name: p.client_id ? (clientMap[p.client_id] ?? '—') : '—',
      status: p.status,
      contract_value: p.contract_value ?? null,
      total_invoiced: t.total_invoiced,
      total_collected: t.total_collected,
      procurement_cost: t.procurement_cost,
      contractor_payments: t.contractor_payments,
      time_cost: t.time_cost,
      other_expenses: t.other_expenses,
      total_cost,
      gross_margin,
      margin_percent,
    }
  })

  return rows.sort((a, b) => b.gross_margin - a.gross_margin)
}

// ─── getStudioPLSummary ───────────────────────────────────────────────────────

export async function getStudioPLSummary(
  period: {
    type: 'monthly' | 'quarterly' | 'annual' | 'custom'
    year?: number
    quarter?: number
    month?: number
    from?: string
    to?: string
  }
): Promise<StudioPLSummary> {
  const { supabase, studioId } = await getAuthContext()

  const { from, to, label } = resolvePeriod(period)

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('studio_id', studioId)

  const projectIds = (projects ?? []).map((p) => p.id)

  const [
    paymentsInPeriod,
    invoiceIdsForProjects,
    procItemsInPeriod,
    procStatusRows,
    stagePaymentsInPeriod,
    timeEntriesInPeriod,
    expenseEntriesInPeriod,
    studioExpensesInPeriod,
    monthlyPayments,
    studioExpensesByMonth,
    projectCostsByMonth,
    studioExpensesGrouped,
  ] = await Promise.all([
    // total_revenue
    supabase
      .from('invoice_payments')
      .select('amount')
      .eq('studio_id', studioId)
      .gte('payment_date', from)
      .lte('payment_date', to),

    // invoice IDs for project-level aggregation
    projectIds.length > 0
      ? supabase.from('invoices').select('id, project_id').in('project_id', projectIds).eq('studio_id', studioId)
      : Promise.resolve({ data: [] }),

    // procurement items in period
    projectIds.length > 0
      ? supabase
          .from('procurement_items')
          .select('id, total_cost')
          .in('project_id', projectIds)
          .eq('studio_id', studioId)
          .gte('created_at', `${from}T00:00:00.000Z`)
          .lte('created_at', `${to}T23:59:59.999Z`)
      : Promise.resolve({ data: [] }),

    // procurement statuses
    supabase
      .from('procurement_item_status')
      .select('item_id, curation_status'),

    // stage payments received in period
    projectIds.length > 0
      ? (supabase.from as AnyQuery)('stage_payments')
          .select('amount')
          .in('project_id', projectIds)
          .eq('studio_id', studioId)
          .eq('status', 'received')
          .gte('updated_at', `${from}T00:00:00.000Z`)
          .lte('updated_at', `${to}T23:59:59.999Z`)
      : Promise.resolve({ data: [] }),

    // time entries in period
    projectIds.length > 0
      ? (supabase.from as AnyQuery)('time_entries')
          .select('hours, hourly_rate_snapshot')
          .in('project_id', projectIds)
          .eq('studio_id', studioId)
          .gte('entry_date', from)
          .lte('entry_date', to)
      : Promise.resolve({ data: [] }),

    // project expense_entries in period
    projectIds.length > 0
      ? supabase
          .from('expense_entries')
          .select('amount')
          .in('project_id', projectIds)
          .eq('studio_id', studioId)
          .gte('expense_date', from)
          .lte('expense_date', to)
      : Promise.resolve({ data: [] }),

    // studio expenses in period
    (supabase.from as AnyQuery)('studio_expenses')
      .select('amount')
      .eq('studio_id', studioId)
      .gte('expense_date', from)
      .lte('expense_date', to),

    // revenue by month (chart)
    supabase
      .from('invoice_payments')
      .select('amount, payment_date')
      .eq('studio_id', studioId)
      .gte('payment_date', from)
      .lte('payment_date', to),

    // studio expenses by month (chart)
    (supabase.from as AnyQuery)('studio_expenses')
      .select('amount, expense_date')
      .eq('studio_id', studioId)
      .gte('expense_date', from)
      .lte('expense_date', to),

    // project costs by month (expense_entries as proxy)
    projectIds.length > 0
      ? supabase
          .from('expense_entries')
          .select('amount, expense_date')
          .in('project_id', projectIds)
          .eq('studio_id', studioId)
          .gte('expense_date', from)
          .lte('expense_date', to)
      : Promise.resolve({ data: [] }),

    // studio expenses by category
    (supabase.from as AnyQuery)('studio_expenses')
      .select('category, amount')
      .eq('studio_id', studioId)
      .gte('expense_date', from)
      .lte('expense_date', to),
  ])

  const total_revenue = ((paymentsInPeriod.data ?? []) as Array<{ amount: number }>).reduce((s, p) => s + p.amount, 0)
  const total_studio_expenses = ((studioExpensesInPeriod.data ?? []) as Array<{ amount: number }>).reduce((s, e) => s + e.amount, 0)

  const approvedItemIds = new Set(
    ((procStatusRows.data ?? []) as Array<{ item_id: string; curation_status: string }>)
      .filter((s) => s.curation_status === 'internally_approved')
      .map((s) => s.item_id)
  )

  const procurement_cost = ((procItemsInPeriod.data ?? []) as Array<{ id: string; total_cost: number }>)
    .filter((i) => approvedItemIds.has(i.id))
    .reduce((s, i) => s + (i.total_cost ?? 0), 0)

  const contractor_cost = ((stagePaymentsInPeriod.data ?? []) as Array<{ amount: number }>).reduce((s, sp) => s + sp.amount, 0)
  const time_cost = ((timeEntriesInPeriod.data ?? []) as Array<{ hours: number; hourly_rate_snapshot: number }>)
    .reduce((s, te) => s + (te.hours ?? 0) * (te.hourly_rate_snapshot ?? 0), 0)
  const other_cost = ((expenseEntriesInPeriod.data ?? []) as Array<{ amount: number }>).reduce((s, e) => s + e.amount, 0)

  const total_project_costs = procurement_cost + contractor_cost + time_cost + other_cost
  const gross_profit = total_revenue - total_project_costs
  const net_profit = gross_profit - total_studio_expenses
  const gross_margin_percent = total_revenue > 0 ? (gross_profit / total_revenue) * 100 : null
  const net_margin_percent = total_revenue > 0 ? (net_profit / total_revenue) * 100 : null

  // revenue_by_month
  const revenueByMonthMap: Record<string, number> = {}
  ;((monthlyPayments.data ?? []) as Array<{ amount: number; payment_date: string }>).forEach((p) => {
    const month = p.payment_date.slice(0, 7)
    revenueByMonthMap[month] = (revenueByMonthMap[month] ?? 0) + p.amount
  })

  const projectCostsByMonthMap: Record<string, number> = {}
  ;((projectCostsByMonth.data ?? []) as Array<{ amount: number; expense_date: string }>).forEach((e) => {
    const month = e.expense_date.slice(0, 7)
    projectCostsByMonthMap[month] = (projectCostsByMonthMap[month] ?? 0) + e.amount
  })

  const studioExpensesByMonthMap: Record<string, number> = {}
  ;((studioExpensesByMonth.data ?? []) as Array<{ amount: number; expense_date: string }>).forEach((e) => {
    const month = e.expense_date.slice(0, 7)
    studioExpensesByMonthMap[month] = (studioExpensesByMonthMap[month] ?? 0) + e.amount
  })

  const allMonths = new Set([
    ...Object.keys(revenueByMonthMap),
    ...Object.keys(projectCostsByMonthMap),
    ...Object.keys(studioExpensesByMonthMap),
  ])

  const revenue_by_month: MonthlyRevenue[] = [...allMonths].sort().map((month) => ({
    month,
    revenue: revenueByMonthMap[month] ?? 0,
    project_costs: projectCostsByMonthMap[month] ?? 0,
    studio_expenses: studioExpensesByMonthMap[month] ?? 0,
  }))

  // expenses_by_category
  const categoryTotals: Record<string, number> = {}
  ;((studioExpensesGrouped.data ?? []) as Array<{ category: string; amount: number }>).forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount
  })

  const catTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0)
  const expenses_by_category: CategoryBreakdown[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: catTotal > 0 ? (amount / catTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const allProjectRows = await getProjectPLRows()
  const top_projects = allProjectRows.slice(0, 5)

  return {
    period_label: label,
    total_revenue,
    total_project_costs,
    total_studio_expenses,
    gross_profit,
    net_profit,
    gross_margin_percent,
    net_margin_percent,
    revenue_by_month,
    expenses_by_category,
    top_projects,
  }
}

// ─── getGSTSummary ────────────────────────────────────────────────────────────

export async function getGSTSummary(
  period: { from: string; to: string }
): Promise<GSTSummary> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, gst_amount, line_items, project_id')
    .eq('studio_id', studioId)
    .gte('issue_date', period.from)
    .lte('issue_date', period.to)
    .in('status', ['sent', 'partial', 'paid', 'overdue'])

  if (error) throw new Error(error.message)

  const invoiceList = invoices ?? []
  const invoice_count = invoiceList.length

  let output_tax_collected = 0
  let cgst_collected = 0
  let sgst_collected = 0
  let igst_collected = 0

  invoiceList.forEach((inv) => {
    output_tax_collected += inv.gst_amount ?? 0

    // Iterate line_items JSONB in app code — no SQL JSON aggregation on arrays
    const lineItems = (inv.line_items ?? []) as Array<{ cgst?: number; sgst?: number; igst?: number }>
    lineItems.forEach((li) => {
      cgst_collected += li.cgst ?? 0
      sgst_collected += li.sgst ?? 0
      igst_collected += li.igst ?? 0
    })
  })

  // Input tax paid: approved procurement items in period
  const projectIds = [...new Set(invoiceList.map((i) => i.project_id).filter(Boolean))] as string[]
  let input_tax_paid = 0

  if (projectIds.length > 0) {
    const { data: procItems } = await supabase
      .from('procurement_items')
      .select('id, unit_cost, quantity')
      .in('project_id', projectIds)
      .eq('studio_id', studioId)
      .gte('created_at', `${period.from}T00:00:00.000Z`)
      .lte('created_at', `${period.to}T23:59:59.999Z`)

    if (procItems && procItems.length > 0) {
      const itemIds = procItems.map((i) => i.id)
      const { data: statuses } = await supabase
        .from('procurement_item_status')
        .select('item_id, curation_status')
        .in('item_id', itemIds)

      const approvedSet = new Set(
        ((statuses ?? []) as Array<{ item_id: string; curation_status: string }>)
          .filter((s) => s.curation_status === 'internally_approved')
          .map((s) => s.item_id)
      )

      // Fixed 18% GST rate since gst_rate is not stored on procurement items
      procItems
        .filter((i) => approvedSet.has(i.id))
        .forEach((i) => {
          const total = (i.unit_cost ?? 0) * (i.quantity ?? 1)
          input_tax_paid += total * 0.18
        })
    }
  }

  const net_gst_liability = output_tax_collected - input_tax_paid
  const fmt = (d: string) => format(new Date(d), 'dd MMM yyyy')

  return {
    period_label: `${fmt(period.from)} – ${fmt(period.to)}`,
    output_tax_collected,
    cgst_collected,
    sgst_collected,
    igst_collected,
    input_tax_paid,
    net_gst_liability,
    invoice_count,
  }
}

// ─── exportPLToCSV ────────────────────────────────────────────────────────────

export async function exportPLToCSV(
  period: { from: string; to: string }
): Promise<string> {
  const { role } = await getAuthContext()

  if (role !== 'owner') throw new Error('Only studio owners can export P&L data')

  const [projectRows, studioExpenses] = await Promise.all([
    getProjectPLRows(),
    getStudioExpenses({ from: period.from, to: period.to }),
  ])

  const f = (n: number) => n.toFixed(2)

  const header1 = 'PROJECT P&L'
  const cols1 = [
    'Project Name', 'Client', 'Status', 'Contract Value',
    'Invoiced', 'Collected', 'Procurement Cost', 'Contractor Payments',
    'Time Cost', 'Other Expenses', 'Total Cost', 'Gross Margin', 'Margin %',
  ].join(',')

  const rows1 = projectRows.map((r) =>
    [
      `"${r.project_name}"`, `"${r.client_name}"`, r.status,
      r.contract_value != null ? f(r.contract_value) : '',
      f(r.total_invoiced), f(r.total_collected), f(r.procurement_cost),
      f(r.contractor_payments), f(r.time_cost), f(r.other_expenses),
      f(r.total_cost), f(r.gross_margin),
      r.margin_percent != null ? r.margin_percent.toFixed(1) + '%' : '',
    ].join(',')
  )

  const header2 = 'STUDIO EXPENSES'
  const cols2 = ['Date', 'Category', 'Description', 'Amount', 'Recurring'].join(',')
  const rows2 = studioExpenses.map((e) =>
    [
      e.expense_date, e.category, `"${e.description}"`, f(e.amount),
      e.is_recurring ? (e.recurrence ?? 'Yes') : 'No',
    ].join(',')
  )

  return [header1, cols1, ...rows1, '', header2, cols2, ...rows2].join('\n')
}
