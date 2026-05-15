"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

export interface TimeEntry {
  id: string
  studio_id: string
  project_id: string
  user_id: string
  entry_date: string
  hours: number
  phase_tag: string | null
  is_billable: boolean
  notes: string | null
  hourly_rate_snapshot: number
  created_at: string
  updated_at: string
  user?: { name: string; role: string }
}

export interface TimeTrackingSummary {
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  total_cost: number
  billable_cost: number
  by_user: Array<{ user_id: string; name: string; hours: number; cost: number }>
  by_phase: Array<{ phase_tag: string; hours: number }>
  this_week_hours: number
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export async function getTimeEntries(projectId: string): Promise<TimeEntry[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: entries, error } = await (supabase.from as AnyQuery)("time_entries")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("entry_date", { ascending: false })

  if (error) throw new Error(error.message)
  const rows = (entries ?? []) as TimeEntry[]

  const userIds = [...new Set(rows.map((e) => e.user_id))]
  if (userIds.length === 0) return rows

  const { data: users } = await supabase
    .from("users")
    .select("id, name, role")
    .in("id", userIds)

  const userMap: Record<string, { name: string; role: string }> = {}
  ;(users ?? []).forEach((u) => { userMap[u.id] = { name: u.name, role: u.role } })

  return rows.map((e) => ({ ...e, user: userMap[e.user_id] }))
}

export async function logTime(input: {
  projectId: string
  entryDate: string
  hours: number
  phaseTag?: string
  isBillable?: boolean
  notes?: string
}): Promise<TimeEntry> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: userRow } = await supabase
    .from("users")
    .select("hourly_rate")
    .eq("id", userId)
    .single()

  const hourlyRate = (userRow?.hourly_rate as number | null) ?? 0

  const { data, error } = await (supabase.from as AnyQuery)("time_entries")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      user_id: userId,
      entry_date: input.entryDate,
      hours: input.hours,
      phase_tag: input.phaseTag ?? null,
      is_billable: input.isBillable ?? true,
      notes: input.notes ?? null,
      hourly_rate_snapshot: hourlyRate,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as TimeEntry
}

export async function updateTimeEntry(
  entryId: string,
  updates: {
    hours?: number
    phaseTag?: string
    isBillable?: boolean
    notes?: string
    entryDate?: string
  }
): Promise<void> {
  const { supabase, userId, studioId, role } = await getAuthContext()

  const { data: entry } = await (supabase.from as AnyQuery)("time_entries")
    .select("user_id, project_id")
    .eq("id", entryId)
    .eq("studio_id", studioId)
    .single()
  if (!entry) throw new Error("Entry not found")

  if (role !== "owner" && entry.user_id !== userId) {
    throw new Error("You can only edit your own time entries")
  }

  const payload: Record<string, unknown> = {}
  if (updates.hours !== undefined) payload.hours = updates.hours
  if (updates.phaseTag !== undefined) payload.phase_tag = updates.phaseTag
  if (updates.isBillable !== undefined) payload.is_billable = updates.isBillable
  if (updates.notes !== undefined) payload.notes = updates.notes
  if (updates.entryDate !== undefined) payload.entry_date = updates.entryDate

  const { error } = await (supabase.from as AnyQuery)("time_entries")
    .update(payload)
    .eq("id", entryId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${entry.project_id}`)
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const { supabase, userId, studioId, role } = await getAuthContext()

  const { data: entry } = await (supabase.from as AnyQuery)("time_entries")
    .select("user_id, project_id")
    .eq("id", entryId)
    .eq("studio_id", studioId)
    .single()
  if (!entry) throw new Error("Entry not found")

  if (role !== "owner" && entry.user_id !== userId) {
    throw new Error("You can only delete your own time entries")
  }

  const { error } = await (supabase.from as AnyQuery)("time_entries")
    .delete()
    .eq("id", entryId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${entry.project_id}`)
}

export async function getTimeTrackingSummary(projectId: string): Promise<TimeTrackingSummary> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: entries } = await (supabase.from as AnyQuery)("time_entries")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  const rows = (entries ?? []) as TimeEntry[]

  const userIds = [...new Set(rows.map((e) => e.user_id))]
  const userMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds)
    ;(users ?? []).forEach((u) => { userMap[u.id] = u.name })
  }

  const monday = getMondayOfWeek(new Date())
  const mondayStr = monday.toISOString().split("T")[0]

  let total_hours = 0
  let billable_hours = 0
  let total_cost = 0
  let billable_cost = 0
  let this_week_hours = 0

  const byUser: Record<string, { name: string; hours: number; cost: number }> = {}
  const byPhase: Record<string, number> = {}

  for (const e of rows) {
    total_hours += e.hours
    total_cost += e.hours * e.hourly_rate_snapshot

    if (e.is_billable) {
      billable_hours += e.hours
      billable_cost += e.hours * e.hourly_rate_snapshot
    }

    if (e.entry_date >= mondayStr) this_week_hours += e.hours

    if (!byUser[e.user_id]) {
      byUser[e.user_id] = { name: userMap[e.user_id] ?? "Unknown", hours: 0, cost: 0 }
    }
    byUser[e.user_id].hours += e.hours
    byUser[e.user_id].cost += e.hours * e.hourly_rate_snapshot

    const phase = e.phase_tag ?? "Untagged"
    byPhase[phase] = (byPhase[phase] ?? 0) + e.hours
  }

  return {
    total_hours,
    billable_hours,
    non_billable_hours: total_hours - billable_hours,
    total_cost,
    billable_cost,
    by_user: Object.entries(byUser).map(([user_id, v]) => ({ user_id, ...v })),
    by_phase: Object.entries(byPhase).map(([phase_tag, hours]) => ({ phase_tag, hours })),
    this_week_hours,
  }
}

export async function getMyTimeEntries(projectId?: string): Promise<TimeEntry[]> {
  const { supabase, userId, studioId } = await getAuthContext()

  let query = (supabase.from as AnyQuery)("time_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("studio_id", studioId)
    .order("entry_date", { ascending: false })

  if (projectId) query = query.eq("project_id", projectId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as TimeEntry[]
}

export async function getWeeklyTimesheetStatus(
  weekStartDate: string
): Promise<Array<{ user_id: string; name: string; hours: number; has_submitted: boolean }>> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner" && role !== "senior_designer") {
    throw new Error("Insufficient permissions")
  }

  const weekEnd = new Date(weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split("T")[0]

  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("name")

  const { data: entries } = await (supabase.from as AnyQuery)("time_entries")
    .select("user_id, hours")
    .eq("studio_id", studioId)
    .gte("entry_date", weekStartDate)
    .lt("entry_date", weekEndStr)

  const hoursMap: Record<string, number> = {}
  const submittedSet = new Set<string>()
  ;(entries ?? []).forEach((e: TimeEntry) => {
    hoursMap[e.user_id] = (hoursMap[e.user_id] ?? 0) + e.hours
    submittedSet.add(e.user_id)
  })

  return (users ?? []).map((u) => ({
    user_id: u.id,
    name: u.name,
    hours: hoursMap[u.id] ?? 0,
    has_submitted: submittedSet.has(u.id),
  }))
}
