"use server"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/service"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  studio_id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  date_of_birth: string | null
  date_of_joining: string | null
  designation: string | null
  employment_type: 'full_time' | 'part_time' | 'contractor' | 'intern'
  department: string | null
  role: 'owner' | 'senior_designer' | 'designer' | 'intern'
  hourly_rate: number | null
  is_active: boolean
  calendar_connected: boolean
  created_at: string
}

export interface LeavePolicy {
  id: string
  studio_id: string
  annual_leave_days: number
  sick_leave_days: number
  casual_leave_days: number
  carry_forward_max: number
  effective_from: string
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  studio_id: string
  user_id: string
  leave_type: 'annual' | 'sick' | 'casual' | 'unpaid'
  start_date: string
  end_date: string
  days_count: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  member?: Pick<TeamMember, 'id' | 'full_name' | 'email' | 'avatar_url' | 'designation'>
  reviewer?: Pick<TeamMember, 'id' | 'full_name'>
}

export interface PayrollEntry {
  id: string
  studio_id: string
  user_id: string
  period_month: number
  period_year: number
  base_amount: number
  deductions: number
  bonuses: number
  net_amount: number
  notes: string | null
  recorded_by_id: string | null
  created_at: string
  member?: Pick<TeamMember, 'id' | 'full_name' | 'email' | 'designation' | 'hourly_rate'>
}

export interface LeaveBalance {
  user_id: string
  annual_used: number
  annual_total: number
  sick_used: number
  sick_total: number
  casual_used: number
  casual_total: number
}

export interface PayrollSummary {
  period_month: number
  period_year: number
  total_base: number
  total_deductions: number
  total_bonuses: number
  total_net: number
  member_count: number
  entries: PayrollEntry[]
}

export interface Announcement {
  id: string
  studio_id: string
  title: string
  body: string
  is_pinned: boolean
  created_by_id: string | null
  created_at: string
  updated_at: string
  author?: Pick<TeamMember, 'id' | 'full_name' | 'avatar_url'>
}

// ─── getTeamMembers ───────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await (supabase.from as any)("users")
    .select("id, studio_id, email, full_name, phone, avatar_url, date_of_birth, date_of_joining, designation, employment_type, department, role, hourly_rate, is_active, calendar_connected, created_at")
    .eq("studio_id", studioId)
    .order("is_active", { ascending: false })
    .order("date_of_joining", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TeamMember[]
}

// ─── getTeamMember ────────────────────────────────────────────────────────────

export async function getTeamMember(userId: string): Promise<TeamMember> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await (supabase.from as any)("users")
    .select("id, studio_id, email, full_name, phone, avatar_url, date_of_birth, date_of_joining, designation, employment_type, department, role, hourly_rate, is_active, created_at")
    .eq("id", userId)
    .single()

  if (error || !data) throw new Error("Member not found")
  if (data.studio_id !== studioId) throw new Error("Member not found")
  return data as TeamMember
}

// ─── updateTeamMember ─────────────────────────────────────────────────────────

export async function updateTeamMember(
  userId: string,
  updates: Partial<Pick<TeamMember, 'full_name' | 'phone' | 'date_of_birth' | 'date_of_joining' | 'designation' | 'employment_type' | 'department' | 'hourly_rate' | 'role' | 'is_active'>>
): Promise<TeamMember> {
  const { supabase, studioId, userId: callerId, role: callerRole } = await getAuthContext()

  const { data: target, error: fetchErr } = await (supabase.from as any)("users")
    .select("id, studio_id, role, is_active")
    .eq("id", userId)
    .single()

  if (fetchErr || !target) throw new Error("Member not found")
  if (target.studio_id !== studioId) throw new Error("Member not found")

  if (('role' in updates || 'is_active' in updates) && callerRole !== 'owner') {
    throw new Error("Insufficient permissions")
  }

  if ('is_active' in updates && updates.is_active === false && userId === callerId) {
    throw new Error("Cannot deactivate your own account")
  }

  if ('is_active' in updates && updates.is_active === false && target.role === 'owner') {
    const { count } = await (supabase.from as any)("users")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .eq("is_active", true)
    if ((count ?? 0) <= 1) throw new Error("Cannot deactivate the last owner")
  }

  if ('role' in updates && updates.role !== 'owner' && target.role === 'owner') {
    const { count } = await (supabase.from as any)("users")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .eq("is_active", true)
    if ((count ?? 0) <= 1) throw new Error("Cannot demote the last owner")
  }

  const { data, error } = await (supabase.from as any)("users")
    .update(updates)
    .eq("id", userId)
    .select("id, studio_id, email, full_name, phone, avatar_url, date_of_birth, date_of_joining, designation, employment_type, department, role, hourly_rate, is_active, created_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Update failed")
  revalidatePath('/dashboard/team')
  return data as TeamMember
}

// ─── uploadAvatar ─────────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const { supabase, studioId } = await getAuthContext()

  const { data: target } = await (supabase.from as any)("users")
    .select("studio_id")
    .eq("id", userId)
    .single()

  if (!target || target.studio_id !== studioId) throw new Error("Member not found")

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `studio/${studioId}/avatars/${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = supabase.storage
    .from("project-files")
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  await (supabase.from as any)("users")
    .update({ avatar_url: publicUrl })
    .eq("id", userId)

  revalidatePath('/dashboard/team')
  return publicUrl
}

// ─── getLeavePolicy ───────────────────────────────────────────────────────────

export async function getLeavePolicy(): Promise<LeavePolicy | null> {
  const { supabase, studioId } = await getAuthContext()

  const { data } = await (supabase.from as any)("leave_policies")
    .select("*")
    .eq("studio_id", studioId)
    .single()

  return (data as LeavePolicy | null) ?? null
}

// ─── upsertLeavePolicy ────────────────────────────────────────────────────────

export async function upsertLeavePolicy(
  input: Omit<LeavePolicy, 'id' | 'studio_id' | 'created_at' | 'updated_at'>
): Promise<LeavePolicy> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner') throw new Error("Insufficient permissions")

  const { data, error } = await (supabase.from as any)("leave_policies")
    .upsert({ ...input, studio_id: studioId }, { onConflict: "studio_id" })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Upsert failed")
  revalidatePath('/dashboard/team')
  return data as LeavePolicy
}

// ─── getLeaveRequests ─────────────────────────────────────────────────────────

export async function getLeaveRequests(filters?: {
  userId?: string
  status?: LeaveRequest['status']
  year?: number
}): Promise<LeaveRequest[]> {
  const { supabase, studioId } = await getAuthContext()

  let query = (supabase.from as any)("leave_requests")
    .select("id, studio_id, user_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_by_id, reviewed_at, review_note, created_at, updated_at")
    .eq("studio_id", studioId)

  if (filters?.userId) query = query.eq("user_id", filters.userId)
  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.year) {
    query = query
      .gte("start_date", `${filters.year}-01-01`)
      .lte("start_date", `${filters.year}-12-31`)
  }

  const { data: requests, error } = await query.order("created_at", { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (requests ?? []) as LeaveRequest[]
  const userIds = [...new Set(rows.map((r: LeaveRequest) => r.user_id))]
  const reviewerIds = [...new Set(rows.map((r: LeaveRequest) => r.reviewed_by_id).filter(Boolean) as string[])]
  const allIds = [...new Set([...userIds, ...reviewerIds])]

  if (allIds.length === 0) return rows

  const { data: users } = await (supabase.from as any)("users")
    .select("id, full_name, email, avatar_url, designation")
    .in("id", allIds)

  const userMap = new Map(((users ?? []) as any[]).map((u: any) => [u.id, u]))

  return rows.map((r: LeaveRequest) => ({
    ...r,
    member: userMap.get(r.user_id)
      ? {
          id: (userMap.get(r.user_id) as any).id,
          full_name: (userMap.get(r.user_id) as any).full_name,
          email: (userMap.get(r.user_id) as any).email,
          avatar_url: (userMap.get(r.user_id) as any).avatar_url,
          designation: (userMap.get(r.user_id) as any).designation,
        }
      : undefined,
    reviewer: r.reviewed_by_id && userMap.get(r.reviewed_by_id)
      ? {
          id: (userMap.get(r.reviewed_by_id) as any).id,
          full_name: (userMap.get(r.reviewed_by_id) as any).full_name,
        }
      : undefined,
  }))
}

// ─── createLeaveRequest ───────────────────────────────────────────────────────

export async function createLeaveRequest(input: {
  leaveType: LeaveRequest['leave_type']
  startDate: string
  endDate: string
  daysCount: number
  reason?: string
}): Promise<LeaveRequest> {
  const { supabase, studioId, userId } = await getAuthContext()

  if (input.daysCount <= 0) throw new Error("Days count must be greater than 0")

  const { data, error } = await (supabase.from as any)("leave_requests")
    .insert({
      studio_id: studioId,
      user_id: userId,
      leave_type: input.leaveType,
      start_date: input.startDate,
      end_date: input.endDate,
      days_count: input.daysCount,
      reason: input.reason ?? null,
      status: 'pending',
    })
    .select("id, studio_id, user_id, leave_type, start_date, end_date, days_count, reason, status, reviewed_by_id, reviewed_at, review_note, created_at, updated_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Insert failed")

  const { notifyLeaveRequest } = await import("./notifications")
  notifyLeaveRequest(data.id).catch(() => {})

  revalidatePath('/dashboard/team')
  return data as LeaveRequest
}

// ─── reviewLeaveRequest ───────────────────────────────────────────────────────

export async function reviewLeaveRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string
): Promise<void> {
  const { supabase, studioId, userId, role } = await getAuthContext()

  if (role === 'designer' || role === 'intern') throw new Error("Insufficient permissions")

  const { data: req, error: fetchErr } = await (supabase.from as any)("leave_requests")
    .select("id, studio_id, status, user_id")
    .eq("id", requestId)
    .single()

  if (fetchErr || !req) throw new Error("Request not found")
  if (req.studio_id !== studioId) throw new Error("Request not found")
  if (req.status !== 'pending') throw new Error("Request is no longer pending")

  const { error } = await (supabase.from as any)("leave_requests")
    .update({
      status: decision,
      reviewed_by_id: userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote ?? null,
    })
    .eq("id", requestId)

  if (error) throw new Error(error.message)

  const { notifyLeaveDecision } = await import("./notifications")
  notifyLeaveDecision(requestId, decision).catch(() => {})

  revalidatePath('/dashboard/team')
}

// ─── cancelLeaveRequest ───────────────────────────────────────────────────────

export async function cancelLeaveRequest(requestId: string): Promise<void> {
  const { supabase, studioId, userId, role } = await getAuthContext()

  const { data: req, error: fetchErr } = await (supabase.from as any)("leave_requests")
    .select("id, studio_id, status, user_id")
    .eq("id", requestId)
    .single()

  if (fetchErr || !req) throw new Error("Request not found")
  if (req.studio_id !== studioId) throw new Error("Request not found")

  const isOwner = req.user_id === userId
  const hasManagerRole = role === 'owner' || role === 'senior_designer'
  if (!isOwner && !hasManagerRole) throw new Error("Insufficient permissions")

  if (req.status !== 'pending') throw new Error("Only pending requests can be cancelled")

  const { error } = await (supabase.from as any)("leave_requests")
    .update({ status: 'cancelled' })
    .eq("id", requestId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/team')
}

// ─── getLeaveBalances ─────────────────────────────────────────────────────────

export async function getLeaveBalances(year: number): Promise<LeaveBalance[]> {
  const { supabase, studioId } = await getAuthContext()

  const [
    { data: policy },
    { data: members },
    { data: requests },
  ] = await Promise.all([
    (supabase.from as any)("leave_policies").select("*").eq("studio_id", studioId).single(),
    (supabase.from as any)("users").select("id").eq("studio_id", studioId).eq("is_active", true),
    (supabase.from as any)("leave_requests")
      .select("user_id, leave_type, days_count")
      .eq("studio_id", studioId)
      .eq("status", "approved")
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`),
  ])

  const annualTotal = (policy as LeavePolicy | null)?.annual_leave_days ?? 12
  const sickTotal = (policy as LeavePolicy | null)?.sick_leave_days ?? 6
  const casualTotal = (policy as LeavePolicy | null)?.casual_leave_days ?? 6

  const usageMap = new Map<string, { annual: number; sick: number; casual: number }>()

  for (const req of ((requests ?? []) as any[])) {
    const existing = usageMap.get(req.user_id) ?? { annual: 0, sick: 0, casual: 0 }
    if (req.leave_type === 'annual') existing.annual += Number(req.days_count)
    else if (req.leave_type === 'sick') existing.sick += Number(req.days_count)
    else if (req.leave_type === 'casual') existing.casual += Number(req.days_count)
    usageMap.set(req.user_id, existing)
  }

  return ((members ?? []) as any[]).map((m: any) => {
    const usage = usageMap.get(m.id) ?? { annual: 0, sick: 0, casual: 0 }
    return {
      user_id: m.id,
      annual_used: usage.annual,
      annual_total: annualTotal,
      sick_used: usage.sick,
      sick_total: sickTotal,
      casual_used: usage.casual,
      casual_total: casualTotal,
    }
  })
}

// ─── getPayrollSummary ────────────────────────────────────────────────────────

export async function getPayrollSummary(month: number, year: number): Promise<PayrollSummary> {
  const { supabase, studioId } = await getAuthContext()

  const { data: entries, error } = await (supabase.from as any)("payroll_entries")
    .select("id, studio_id, user_id, period_month, period_year, base_amount, deductions, bonuses, net_amount, notes, recorded_by_id, created_at")
    .eq("studio_id", studioId)
    .eq("period_month", month)
    .eq("period_year", year)

  if (error) throw new Error(error.message)

  const rows = ((entries ?? []) as any[]) as PayrollEntry[]
  const userIds = [...new Set(rows.map((r: PayrollEntry) => r.user_id))]

  let memberMap = new Map<string, any>()
  if (userIds.length > 0) {
    const { data: users } = await (supabase.from as any)("users")
      .select("id, full_name, email, designation, hourly_rate")
      .in("id", userIds)
    memberMap = new Map(((users ?? []) as any[]).map((u: any) => [u.id, u]))
  }

  const enriched = rows.map((r: PayrollEntry) => ({ ...r, member: memberMap.get(r.user_id) }))

  const total_base = rows.reduce((s: number, r: PayrollEntry) => s + Number(r.base_amount), 0)
  const total_deductions = rows.reduce((s: number, r: PayrollEntry) => s + Number(r.deductions), 0)
  const total_bonuses = rows.reduce((s: number, r: PayrollEntry) => s + Number(r.bonuses), 0)
  const total_net = rows.reduce((s: number, r: PayrollEntry) => s + Number(r.net_amount), 0)

  return {
    period_month: month,
    period_year: year,
    total_base,
    total_deductions,
    total_bonuses,
    total_net,
    member_count: rows.length,
    entries: enriched,
  }
}

// ─── upsertPayrollEntry ───────────────────────────────────────────────────────

export async function upsertPayrollEntry(input: {
  userId: string
  periodMonth: number
  periodYear: number
  baseAmount: number
  deductions: number
  bonuses: number
  notes?: string
}): Promise<PayrollEntry> {
  const { supabase, studioId, userId: callerId, role } = await getAuthContext()

  if (role !== 'owner') throw new Error("Insufficient permissions")

  const { data: target } = await (supabase.from as any)("users")
    .select("studio_id")
    .eq("id", input.userId)
    .single()

  if (!target || target.studio_id !== studioId) throw new Error("Member not found")

  const { data, error } = await (supabase.from as any)("payroll_entries")
    .upsert(
      {
        studio_id: studioId,
        user_id: input.userId,
        period_month: input.periodMonth,
        period_year: input.periodYear,
        base_amount: input.baseAmount,
        deductions: input.deductions,
        bonuses: input.bonuses,
        notes: input.notes ?? null,
        recorded_by_id: callerId,
      },
      { onConflict: "studio_id,user_id,period_month,period_year" }
    )
    .select("id, studio_id, user_id, period_month, period_year, base_amount, deductions, bonuses, net_amount, notes, recorded_by_id, created_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Upsert failed")
  revalidatePath('/dashboard/team')
  return data as PayrollEntry
}

// ─── deletePayrollEntry ───────────────────────────────────────────────────────

export async function deletePayrollEntry(entryId: string): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner') throw new Error("Insufficient permissions")

  const { data: entry } = await (supabase.from as any)("payroll_entries")
    .select("studio_id")
    .eq("id", entryId)
    .single()

  if (!entry || entry.studio_id !== studioId) throw new Error("Entry not found")

  const { error } = await (supabase.from as any)("payroll_entries")
    .delete()
    .eq("id", entryId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/team')
}

// ─── getAnnouncements ─────────────────────────────────────────────────────────

export async function getAnnouncements(): Promise<Announcement[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rows, error } = await (supabase.from as any)("announcements")
    .select("id, studio_id, title, body, is_pinned, created_by_id, created_at, updated_at")
    .eq("studio_id", studioId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const announcements = ((rows ?? []) as any[]) as Announcement[]
  const authorIds = [...new Set(announcements.map(a => a.created_by_id).filter(Boolean) as string[])]

  if (authorIds.length === 0) return announcements

  const { data: users } = await (supabase.from as any)("users")
    .select("id, full_name, avatar_url")
    .in("id", authorIds)

  const authorMap = new Map(((users ?? []) as any[]).map((u: any) => [u.id, u]))

  return announcements.map((a: Announcement) => ({
    ...a,
    author: a.created_by_id && authorMap.get(a.created_by_id)
      ? {
          id: (authorMap.get(a.created_by_id) as any).id,
          full_name: (authorMap.get(a.created_by_id) as any).full_name,
          avatar_url: (authorMap.get(a.created_by_id) as any).avatar_url,
        }
      : undefined,
  }))
}

// ─── createAnnouncement ───────────────────────────────────────────────────────

export async function createAnnouncement(input: {
  title: string
  body: string
  isPinned?: boolean
}): Promise<Announcement> {
  const { supabase, studioId, userId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') throw new Error("Insufficient permissions")

  const { data, error } = await (supabase.from as any)("announcements")
    .insert({
      studio_id: studioId,
      title: input.title,
      body: input.body,
      is_pinned: input.isPinned ?? false,
      created_by_id: userId,
    })
    .select("id, studio_id, title, body, is_pinned, created_by_id, created_at, updated_at")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Insert failed")

  const { data: author } = await (supabase.from as any)("users")
    .select("id, full_name, avatar_url")
    .eq("id", userId)
    .single()

  revalidatePath('/dashboard/team')
  return {
    ...(data as Announcement),
    author: author ? { id: author.id, full_name: author.full_name, avatar_url: author.avatar_url } : undefined,
  }
}

// ─── updateAnnouncement ───────────────────────────────────────────────────────

export async function updateAnnouncement(
  announcementId: string,
  updates: Partial<Pick<Announcement, 'title' | 'body' | 'is_pinned'>>
): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') throw new Error("Insufficient permissions")

  const { data: existing } = await (supabase.from as any)("announcements")
    .select("studio_id")
    .eq("id", announcementId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error("Announcement not found")

  const { error } = await (supabase.from as any)("announcements")
    .update(updates)
    .eq("id", announcementId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/team')
}

// ─── deleteAnnouncement ───────────────────────────────────────────────────────

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner') throw new Error("Insufficient permissions")

  const { data: existing } = await (supabase.from as any)("announcements")
    .select("studio_id")
    .eq("id", announcementId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error("Announcement not found")

  const { error } = await (supabase.from as any)("announcements")
    .delete()
    .eq("id", announcementId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/team')
}

// ─── inviteTeamMember ─────────────────────────────────────────────────────────

export async function inviteTeamMember(
  email: string,
  role: 'senior_designer' | 'designer' | 'intern'
): Promise<void> {
  const { studioId, role: callerRole } = await getAuthContext()

  if (callerRole !== 'owner') throw new Error("Insufficient permissions")

  const supabaseAdmin = createServiceClient()

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { studio_id: studioId, role },
  })

  if (error) throw new Error(error.message)
}

// ─── getPendingLeaveCount ─────────────────────────────────────────────────────

export async function getPendingLeaveCount(): Promise<number> {
  const { supabase, studioId } = await getAuthContext()

  const { count } = await (supabase.from as any)("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("status", "pending")

  return count ?? 0
}

// ─── getPendingLeaveRequestsCount (Sprint 16 — dashboard widget) ─────────────

export async function getPendingLeaveRequestsCount(): Promise<number> {
  return getPendingLeaveCount()
}
