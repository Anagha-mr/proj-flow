"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"
import type { HealthSignals } from "./dashboard"

// ─── calculateHealthScore ─────────────────────────────────────────────────────

export async function calculateHealthScore(projectId: string): Promise<HealthSignals> {
  const supabase = createServiceClient()

  const today = new Date().toISOString().split('T')[0]
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all 4 signals in parallel
  const [overdueTasks, overdueRfis, procItems, overdueInvoices] = await Promise.all([
    // 1. Overdue tasks
    supabase
      .from('tasks')
      .select('id, due_date')
      .eq('project_id', projectId)
      .lt('due_date', today)
      .neq('status', 'done'),

    // 2. Unanswered RFIs past deadline
    supabase
      .from('rfis')
      .select('id')
      .eq('project_id', projectId)
      .lt('response_deadline', today)
      .eq('status', 'open'),

    // 3. Procurement items with pending approval
    (async () => {
      const { data: items } = await supabase
        .from('procurement_items')
        .select('id')
        .eq('project_id', projectId)

      if (!items || items.length === 0) return { data: [] }

      const itemIds = items.map((i) => i.id)
      return supabase
        .from('procurement_item_status')
        .select('id, updated_at')
        .in('item_id', itemIds)
        .eq('client_approval_status', 'pending')
    })(),

    // 4. Overdue invoices
    supabase
      .from('invoices')
      .select('id, due_date')
      .eq('project_id', projectId)
      .lt('due_date', today)
      .not('status', 'in', '("paid","cancelled")'),
  ])

  // ── Score signal 1: Overdue tasks ─────────────────────────────────────────
  const overdueTaskList = overdueTasks.data ?? []
  const overdueTaskCount = overdueTaskList.length
  const hasVeryLateTask = overdueTaskList.some((t) => {
    if (!t.due_date) return false
    const days = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)
    return days >= 7
  })

  let overdue_tasks_status: 'green' | 'amber' | 'red'
  if (overdueTaskCount === 0) overdue_tasks_status = 'green'
  else if (overdueTaskCount >= 4 || hasVeryLateTask) overdue_tasks_status = 'red'
  else overdue_tasks_status = 'amber'

  // ── Score signal 2: Unanswered RFIs ──────────────────────────────────────
  const overdueRfiCount = (overdueRfis.data ?? []).length
  let unanswered_rfis_status: 'green' | 'amber' | 'red'
  if (overdueRfiCount === 0) unanswered_rfis_status = 'green'
  else if (overdueRfiCount >= 2) unanswered_rfis_status = 'red'
  else unanswered_rfis_status = 'amber'

  // ── Score signal 3: Procurement lag ──────────────────────────────────────
  const pendingProcList = (procItems as { data: Array<{ id: string; updated_at: string }> | null }).data ?? []
  let procLagDaysMax = 0
  for (const pp of pendingProcList) {
    const days = Math.floor((Date.now() - new Date(pp.updated_at).getTime()) / 86400000)
    if (days > procLagDaysMax) procLagDaysMax = days
  }

  let procurement_lag_status: 'green' | 'amber' | 'red'
  if (procLagDaysMax === 0) procurement_lag_status = 'green'
  else if (procLagDaysMax >= 10) procurement_lag_status = 'red'
  else if (procLagDaysMax >= 5) procurement_lag_status = 'amber'
  else procurement_lag_status = 'green'

  // ── Score signal 4: Invoice payment ──────────────────────────────────────
  const overdueInvoiceList = overdueInvoices.data ?? []
  let invoiceOverdueDaysMax = 0
  for (const inv of overdueInvoiceList) {
    if (!inv.due_date) continue
    const days = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
    if (days > invoiceOverdueDaysMax) invoiceOverdueDaysMax = days
  }

  let invoice_overdue_status: 'green' | 'amber' | 'red'
  if (invoiceOverdueDaysMax === 0) invoice_overdue_status = 'green'
  else if (invoiceOverdueDaysMax >= 14) invoice_overdue_status = 'red'
  else invoice_overdue_status = 'amber'

  // ── Overall ────────────────────────────────────────────────────────────────
  const statuses = [overdue_tasks_status, unanswered_rfis_status, procurement_lag_status, invoice_overdue_status]
  let overall: 'green' | 'amber' | 'red'
  if (statuses.includes('red')) overall = 'red'
  else if (statuses.includes('amber')) overall = 'amber'
  else overall = 'green'

  // Silence unused variable warnings
  void fiveDaysAgo
  void tenDaysAgo

  return {
    overdue_tasks: overdueTaskCount,
    overdue_tasks_status,
    unanswered_rfis: overdueRfiCount,
    unanswered_rfis_status,
    procurement_lag_days_max: procLagDaysMax,
    procurement_lag_status,
    invoice_overdue_days_max: invoiceOverdueDaysMax,
    invoice_overdue_status,
    overall,
  }
}

// ─── updateProjectHealthScore ─────────────────────────────────────────────────

export async function updateProjectHealthScore(projectId: string): Promise<void> {
  const supabase = createServiceClient()

  // Read old score before updating (cast — new columns added by sprint 16 migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase.from as any)('projects')
    .select('health_score')
    .eq('id', projectId)
    .single() as { data: { health_score?: string } | null }

  const oldScore = (current?.health_score ?? null) as 'green' | 'amber' | 'red' | null

  const signals = await calculateHealthScore(projectId)
  const newScore = signals.overall

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('projects')
    .update({
      health_score: newScore,
      health_signals: signals,
      health_last_calculated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  console.log(`Health score recalculated: ${projectId} → ${newScore}`)

  // Fire health alert if score worsened
  const scoredWorse =
    (oldScore === 'green' && (newScore === 'amber' || newScore === 'red')) ||
    (oldScore === 'amber' && newScore === 'red')

  if (scoredWorse) {
    // Fire and forget — never awaited
    const { notifyProjectHealthAlert } = await import('./notifications')
    notifyProjectHealthAlert(projectId, signals).catch(() => {})
  }

  revalidatePath('/dashboard')
}

// ─── recalculateAllProjectHealthScores ───────────────────────────────────────

export async function recalculateAllProjectHealthScores(): Promise<void> {
  const supabase = createServiceClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .in('status', ['active', 'in_progress'])

  for (const project of projects ?? []) {
    try {
      await updateProjectHealthScore(project.id)
    } catch (err) {
      console.error(`Failed to recalculate health for project ${project.id}:`, err)
    }
  }
}
