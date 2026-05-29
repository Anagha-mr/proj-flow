"use server"

import { getAuthContext } from "./_auth"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  activeProjectsCount: number
  tasksDueTodayCount: number
  overdueInvoicesTotal: number
  overdueInvoicesCount: number
  teamCapacity: TeamCapacityEntry[]
}

export interface TeamCapacityEntry {
  userId: string
  userName: string
  avatarUrl: string | null
  assignedTasksCount: number
  overdueTasksCount: number
}

export interface DashboardProjectCard {
  id: string
  name: string
  clientName: string
  coverImageUrl: string | null
  currentPhase: string | null
  progressPercent: number
  healthScore: 'green' | 'amber' | 'red'
  healthSignals: HealthSignals | null
  nextMilestone: string | null
  nextMilestoneDate: string | null
  overdueTaskCount: number
  status: string
}

export interface HealthSignals {
  overdue_tasks: number
  overdue_tasks_status: 'green' | 'amber' | 'red'
  unanswered_rfis: number
  unanswered_rfis_status: 'green' | 'amber' | 'red'
  procurement_lag_days_max: number
  procurement_lag_status: 'green' | 'amber' | 'red'
  invoice_overdue_days_max: number
  invoice_overdue_status: 'green' | 'amber' | 'red'
  overall: 'green' | 'amber' | 'red'
}

export interface ActivityFeedItem {
  id: string
  type: 'overdue_task' | 'unanswered_rfi' | 'overdue_invoice' | 'pending_procurement' | 'new_site_update'
  projectId: string
  projectName: string
  title: string
  subtitle: string
  linkHref: string
  createdAt: string
  severity: 'critical' | 'warning' | 'info'
}

// ─── getDashboardMetrics ──────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { supabase, studioId } = await getAuthContext()

  const today = new Date().toISOString().split('T')[0]
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 1. Active project IDs
  const { data: activeProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('studio_id', studioId)
    .in('status', ['active', 'in_progress'])

  const activeProjectIds = (activeProjects ?? []).map((p) => p.id)
  const activeProjectsCount = activeProjectIds.length

  // 2. Tasks due today (across active projects)
  let tasksDueTodayCount = 0
  if (activeProjectIds.length > 0) {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('project_id', activeProjectIds)
      .eq('due_date', today)
      .neq('status', 'done')

    tasksDueTodayCount = count ?? 0
  }

  // 3. Overdue invoices — fetch overdue invoices then payments separately
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, total')
    .eq('studio_id', studioId)
    .lt('due_date', today)
    .not('status', 'in', '("paid","cancelled")')

  let overdueInvoicesTotal = 0
  let overdueInvoicesCount = 0

  if (overdueInvoices && overdueInvoices.length > 0) {
    overdueInvoicesCount = overdueInvoices.length
    const invoiceIds = overdueInvoices.map((i) => i.id)

    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount')
      .in('invoice_id', invoiceIds)

    const paidByInvoice: Record<string, number> = {}
    for (const p of payments ?? []) {
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] ?? 0) + Number(p.amount)
    }

    for (const inv of overdueInvoices) {
      const paid = paidByInvoice[inv.id] ?? 0
      const outstanding = Number(inv.total) - paid
      if (outstanding > 0) overdueInvoicesTotal += outstanding
    }
  }

  // 4. Team capacity — fetch all active studio users
  const { data: studioUsers } = await supabase
    .from('users')
    .select('id, name, profile_photo_url')
    .eq('studio_id', studioId)
    .eq('is_active', true)

  const teamCapacity: TeamCapacityEntry[] = []

  if (studioUsers && studioUsers.length > 0) {
    const userIds = studioUsers.map((u) => u.id)

    // Fetch task assignees for tasks due in next 14 days (not done)
    const { data: assigneeRows } = await supabase
      .from('task_assignees')
      .select('user_id, task_id')
      .in('user_id', userIds)

    const taskIds = [...new Set((assigneeRows ?? []).map((a) => a.task_id))]

    let relevantTasks: Array<{ id: string; due_date: string | null; status: string }> = []
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date, status')
        .in('id', taskIds)
        .neq('status', 'done')
        .lte('due_date', in14Days)

      relevantTasks = tasks ?? []
    }

    const taskMap = new Map(relevantTasks.map((t) => [t.id, t]))

    for (const user of studioUsers) {
      const userTaskIds = (assigneeRows ?? [])
        .filter((a) => a.user_id === user.id)
        .map((a) => a.task_id)

      let assignedTasksCount = 0
      let overdueTasksCount = 0

      for (const tid of userTaskIds) {
        const task = taskMap.get(tid)
        if (!task) continue
        assignedTasksCount++
        if (task.due_date && task.due_date < today) overdueTasksCount++
      }

      if (assignedTasksCount > 0) {
        teamCapacity.push({
          userId: user.id,
          userName: user.name ?? 'Unknown',
          avatarUrl: user.profile_photo_url ?? null,
          assignedTasksCount,
          overdueTasksCount,
        })
      }
    }

    teamCapacity.sort((a, b) => b.assignedTasksCount - a.assignedTasksCount)
  }

  return {
    activeProjectsCount,
    tasksDueTodayCount,
    overdueInvoicesTotal,
    overdueInvoicesCount,
    teamCapacity,
  }
}

// ─── getDashboardProjectCards ─────────────────────────────────────────────────

export async function getDashboardProjectCards(): Promise<DashboardProjectCard[]> {
  const { supabase, studioId } = await getAuthContext()

  const today = new Date().toISOString().split('T')[0]

  // 1. Fetch active/in_progress projects (cast to any — health_score/health_signals added by sprint 16 migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabase.from as any)('projects')
    .select('id, name, client_id, cover_image_url, phases, health_score, health_signals, status')
    .eq('studio_id', studioId)
    .in('status', ['active', 'in_progress']) as { data: Array<Record<string, unknown>> | null }

  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p) => p.id as string)
  const clientIds = [...new Set(projects.map((p) => p.client_id as string | null).filter(Boolean) as string[])]

  // 2. Fetch client names separately
  const clientMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)
    for (const c of clients ?? []) clientMap[c.id] = c.name
  }

  // 3. Fetch task counts per project
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('id, project_id, status, due_date')
    .in('project_id', projectIds)

  const taskStats: Record<string, { total: number; done: number; overdue: number }> = {}
  for (const t of allTasks ?? []) {
    if (!taskStats[t.project_id]) taskStats[t.project_id] = { total: 0, done: 0, overdue: 0 }
    taskStats[t.project_id].total++
    if (t.status === 'done') taskStats[t.project_id].done++
    if (t.due_date && t.due_date < today && t.status !== 'done') taskStats[t.project_id].overdue++
  }

  // 4. Fetch nearest upcoming milestone per project (tasks with due_date >= today, not done)
  const { data: upcomingTasks } = await supabase
    .from('tasks')
    .select('id, project_id, title, due_date')
    .in('project_id', projectIds)
    .gte('due_date', today)
    .neq('status', 'done')
    .order('due_date', { ascending: true })

  // Pick nearest per project
  const milestoneMap: Record<string, { title: string; due_date: string }> = {}
  for (const t of upcomingTasks ?? []) {
    if (!milestoneMap[t.project_id] && t.due_date) {
      milestoneMap[t.project_id] = { title: t.title, due_date: t.due_date }
    }
  }

  // 5. Build cards
  const healthOrder: Record<string, number> = { red: 0, amber: 1, green: 2 }

  const cards: DashboardProjectCard[] = projects.map((p) => {
    const pid = p.id as string
    const stats = taskStats[pid] ?? { total: 0, done: 0, overdue: 0 }
    const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

    // Extract currentPhase from phases JSONB
    let currentPhase: string | null = null
    const phases = p.phases as Array<{ status?: string; name?: string }> | null
    if (Array.isArray(phases) && phases.length > 0) {
      const active = phases.find((ph) => ph.status === 'active')
      currentPhase = active?.name ?? phases[0]?.name ?? null
    }

    const milestone = milestoneMap[pid]
    const clientId = p.client_id as string | null

    return {
      id: pid,
      name: p.name as string,
      clientName: clientId ? (clientMap[clientId] ?? 'Unknown Client') : 'No Client',
      coverImageUrl: (p.cover_image_url as string | null) ?? null,
      currentPhase,
      progressPercent,
      healthScore: ((p.health_score as string) ?? 'green') as 'green' | 'amber' | 'red',
      healthSignals: (p.health_signals as HealthSignals | null) ?? null,
      nextMilestone: milestone?.title ?? null,
      nextMilestoneDate: milestone?.due_date ?? null,
      overdueTaskCount: stats.overdue,
      status: p.status as string,
    }
  })

  // Sort: red → amber → green, then by nextMilestoneDate ASC (nulls last)
  cards.sort((a, b) => {
    const hDiff = (healthOrder[a.healthScore] ?? 2) - (healthOrder[b.healthScore] ?? 2)
    if (hDiff !== 0) return hDiff
    if (!a.nextMilestoneDate && !b.nextMilestoneDate) return 0
    if (!a.nextMilestoneDate) return 1
    if (!b.nextMilestoneDate) return -1
    return a.nextMilestoneDate.localeCompare(b.nextMilestoneDate)
  })

  return cards
}

// ─── getDashboardActivityFeed ─────────────────────────────────────────────────

export async function getDashboardActivityFeed(): Promise<ActivityFeedItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const today = new Date().toISOString().split('T')[0]
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch active project IDs first
  const { data: activeProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('studio_id', studioId)
    .in('status', ['active', 'in_progress'])

  const activeProjectIds = (activeProjects ?? []).map((p) => p.id)

  const items: ActivityFeedItem[] = []

  const allProjectIds = new Set<string>()

  // ── 1. Overdue tasks ────────────────────────────────────────────────────────
  let overdueTasks: Array<{ id: string; title: string; due_date: string; project_id: string }> = []
  if (activeProjectIds.length > 0) {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, due_date, project_id')
      .in('project_id', activeProjectIds)
      .lt('due_date', today)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(10)
    overdueTasks = ((data ?? []) as Array<{ id: string; title: string; due_date: string | null; project_id: string }>)
      .filter((t) => t.due_date !== null)
      .map((t) => ({ ...t, due_date: t.due_date! }))
    overdueTasks.forEach((t) => allProjectIds.add(t.project_id))
  }

  // ── 2. Unanswered RFIs past deadline ───────────────────────────────────────
  let overdueRfis: Array<{ id: string; title: string; response_deadline: string; project_id: string }> = []
  if (activeProjectIds.length > 0) {
    const { data } = await supabase
      .from('rfis')
      .select('id, title, response_deadline, project_id')
      .in('project_id', activeProjectIds)
      .lt('response_deadline', today)
      .eq('status', 'open')
      .limit(5)
    overdueRfis = data ?? []
    overdueRfis.forEach((r) => allProjectIds.add(r.project_id))
  }

  // ── 3. Overdue invoices ─────────────────────────────────────────────────────
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, due_date, project_id')
    .eq('studio_id', studioId)
    .lt('due_date', today)
    .not('status', 'in', '("paid","cancelled")')
    .limit(10)
  ;(overdueInvoices ?? []).forEach((i) => allProjectIds.add(i.project_id))

  // ── 4. Procurement pending approval 5+ days ────────────────────────────────
  let pendingProcurement: Array<{ id: string; item_id: string; updated_at: string }> = []
  if (activeProjectIds.length > 0) {
    const { data: itemIds } = await supabase
      .from('procurement_items')
      .select('id, project_id')
      .in('project_id', activeProjectIds)

    const procItemIds = (itemIds ?? []).map((i) => i.id)
    const projectByItem: Record<string, string> = {}
    for (const i of itemIds ?? []) projectByItem[i.id] = i.project_id

    if (procItemIds.length > 0) {
      const { data } = await supabase
        .from('procurement_item_status')
        .select('id, item_id, updated_at')
        .in('item_id', procItemIds)
        .eq('client_approval_status', 'pending')
        .lt('updated_at', fiveDaysAgo)
        .limit(5)
      pendingProcurement = data ?? []
      for (const pp of pendingProcurement) {
        const pid = projectByItem[pp.item_id]
        if (pid) allProjectIds.add(pid)
      }
    }
  }

  // ── 5. New site updates today ───────────────────────────────────────────────
  let siteUpdates: Array<{ id: string; status_note: string | null; project_id: string; submitted_at: string }> = []
  if (activeProjectIds.length > 0) {
    const { data } = await supabase
      .from('site_updates')
      .select('id, status_note, project_id, submitted_at')
      .in('project_id', activeProjectIds)
      .gte('submitted_at', `${today}T00:00:00`)
      .eq('is_client_visible', true)
      .limit(5)
    siteUpdates = data ?? []
    siteUpdates.forEach((s) => allProjectIds.add(s.project_id))
  }

  // Fetch all project names in one query
  const projectNameMap: Record<string, string> = {}
  if (allProjectIds.size > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', [...allProjectIds])
    for (const p of projects ?? []) projectNameMap[p.id] = p.name
  }

  // Build activity items

  for (const t of overdueTasks) {
    const daysLate = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000)
    items.push({
      id: `task-${t.id}`,
      type: 'overdue_task',
      projectId: t.project_id,
      projectName: projectNameMap[t.project_id] ?? 'Unknown',
      title: `Task overdue ${daysLate}d: ${t.title}`,
      subtitle: `Due ${t.due_date}`,
      linkHref: `/dashboard/projects/${t.project_id}/tasks`,
      createdAt: t.due_date,
      severity: daysLate >= 7 ? 'critical' : 'warning',
    })
  }

  for (const r of overdueRfis) {
    items.push({
      id: `rfi-${r.id}`,
      type: 'unanswered_rfi',
      projectId: r.project_id,
      projectName: projectNameMap[r.project_id] ?? 'Unknown',
      title: `RFI unanswered past deadline: ${r.title}`,
      subtitle: `Deadline was ${r.response_deadline}`,
      linkHref: `/dashboard/projects/${r.project_id}/rfi`,
      createdAt: r.response_deadline,
      severity: 'critical',
    })
  }

  for (const inv of overdueInvoices ?? []) {
    if (!inv.due_date) continue
    const daysLate = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
    const formatted = Number(inv.total).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })
    items.push({
      id: `invoice-${inv.id}`,
      type: 'overdue_invoice',
      projectId: inv.project_id,
      projectName: projectNameMap[inv.project_id] ?? 'Unknown',
      title: `Invoice overdue ${daysLate}d: ${formatted}`,
      subtitle: inv.invoice_number ?? '',
      linkHref: `/dashboard/projects/${inv.project_id}/finance`,
      createdAt: inv.due_date,
      severity: daysLate >= 14 ? 'critical' : 'warning',
    })
  }

  for (const pp of pendingProcurement) {
    const daysPending = Math.floor((Date.now() - new Date(pp.updated_at).getTime()) / 86400000)
    // Find project for this item
    const { data: itemData } = await supabase
      .from('procurement_items')
      .select('project_id, name')
      .eq('id', pp.item_id)
      .single()
    if (!itemData) continue
    items.push({
      id: `proc-${pp.id}`,
      type: 'pending_procurement',
      projectId: itemData.project_id,
      projectName: projectNameMap[itemData.project_id] ?? 'Unknown',
      title: `Procurement pending approval ${daysPending}d: ${itemData.name}`,
      subtitle: 'Client approval pending',
      linkHref: `/dashboard/projects/${itemData.project_id}/procurement/approvals`,
      createdAt: pp.updated_at,
      severity: 'warning',
    })
  }

  for (const su of siteUpdates) {
    items.push({
      id: `site-${su.id}`,
      type: 'new_site_update',
      projectId: su.project_id,
      projectName: projectNameMap[su.project_id] ?? 'Unknown',
      title: `New site update: ${su.status_note ?? 'Update posted today'}`,
      subtitle: 'Submitted today',
      linkHref: `/dashboard/projects/${su.project_id}/site`,
      createdAt: su.submitted_at,
      severity: 'info',
    })
  }

  // Sort: critical first, then warning, then info; within each group by createdAt DESC
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => {
    const sDiff = (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
    if (sDiff !== 0) return sDiff
    return b.createdAt.localeCompare(a.createdAt)
  })

  return items.slice(0, 20)
}
