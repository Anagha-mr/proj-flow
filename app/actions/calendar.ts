"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"
import {
  refreshGoogleToken,
  fetchGoogleCalendarEvents,
  buildEventHash,
} from "@/lib/utils/calendar-sync-core"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarConnection {
  id: string
  user_id: string
  google_email: string
  google_calendar_id: string
  is_active: boolean
  connected_at: string
  last_sync_at: string | null
}

export interface BusyBlock {
  id: string
  user_id: string
  user_name?: string
  title: string | null
  start_at: string
  end_at: string
  is_all_day: boolean
  is_own: boolean
}

export interface ResourceConflict {
  user_id: string
  user_name: string
  conflict_date: string
  pf_event_title: string
  pf_event_type: 'meeting' | 'site_visit' | 'task_due_date'
  busy_block_start: string
  busy_block_end: string
}

export type PushableSourceType =
  | 'task_due_date'
  | 'meeting'
  | 'site_visit'
  | 'invoice_due_date'
  | 'project_milestone'

// ─── Internal: ensure fresh access token ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureFreshToken(conn: any): Promise<string> {
  const expiry = new Date(conn.token_expiry).getTime()
  const fiveMinMs = 5 * 60 * 1000

  if (Date.now() + fiveMinMs < expiry) {
    return conn.access_token as string
  }

  const refreshed = await refreshGoogleToken(conn.refresh_token as string)
  if (!refreshed) return conn.access_token as string

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from as any)("calendar_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
    .eq("id", conn.id)

  return refreshed.access_token
}

// ─── getCalendarConnection ────────────────────────────────────────────────────

export async function getCalendarConnection(): Promise<CalendarConnection | null> {
  const { supabase, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)("calendar_connections")
    .select("id, user_id, google_email, google_calendar_id, is_active, connected_at, last_sync_at")
    .eq("user_id", userId)
    .maybeSingle()

  return (data ?? null) as CalendarConnection | null
}

// ─── disconnectCalendar ───────────────────────────────────────────────────────

export async function disconnectCalendar(): Promise<void> {
  const { supabase, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("calendar_connections")
    .update({ is_active: false })
    .eq("user_id", userId)

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("users")
    .update({ calendar_connected: false })
    .eq("id", userId)

  // Stale busy blocks cleanup — does NOT delete event_links (preserve dedup on reconnect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("calendar_busy_blocks")
    .delete()
    .eq("user_id", userId)

  revalidatePath("/dashboard/settings")
}

// ─── pushToGoogleCalendar ─────────────────────────────────────────────────────
// Fire-and-forget — NEVER throws. Wrapped in outer try/catch at call sites.

export async function pushToGoogleCalendar(
  sourceType: PushableSourceType,
  sourceId: string
): Promise<void> {
  try {
    const { supabase, userId, studioId } = await getAuthContext()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (supabase.from as any)("calendar_connections")
      .select("id, access_token, refresh_token, token_expiry, google_calendar_id, is_active")
      .eq("user_id", userId)
      .maybeSingle()

    if (!conn || !conn.is_active) return

    const accessToken = await ensureFreshToken(conn)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

    // Build event payload per source type
    let eventPayload: Record<string, unknown> | null = null
    let projectId: string | null = null

    if (sourceType === "task_due_date") {
      const { data: task } = await supabase
        .from("tasks")
        .select("id, title, due_date, project_id")
        .eq("id", sourceId)
        .eq("studio_id", studioId)
        .maybeSingle()

      if (!task?.due_date) return

      projectId = task.project_id
      eventPayload = {
        summary: task.title,
        description: `View in ProjectFlow: ${appUrl}/dashboard/projects/${task.project_id}/tasks`,
        start: { date: task.due_date },
        end: { date: task.due_date },
      }
    } else if (sourceType === "meeting") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: meeting } = await (supabase.from as any)("meetings")
        .select("id, title, meeting_date, start_time, end_time, location, agenda, project_id")
        .eq("id", sourceId)
        .eq("studio_id", studioId)
        .maybeSingle()

      if (!meeting) return

      projectId = meeting.project_id
      const startDt = meeting.start_time
        ? `${meeting.meeting_date}T${meeting.start_time}`
        : null
      const endDt = meeting.end_time
        ? `${meeting.meeting_date}T${meeting.end_time}`
        : startDt
        ? `${meeting.meeting_date}T${String(Number(meeting.start_time.split(":")[0]) + 1).padStart(2, "0")}:${meeting.start_time.split(":")[1]}:00`
        : null

      if (startDt && endDt) {
        eventPayload = {
          summary: meeting.title,
          description: [
            meeting.agenda ? `Agenda: ${meeting.agenda}` : null,
            `View in ProjectFlow: ${appUrl}/dashboard/projects/${meeting.project_id}/meetings`,
          ]
            .filter(Boolean)
            .join("\n"),
          start: { dateTime: startDt, timeZone: "Asia/Kolkata" },
          end: { dateTime: endDt, timeZone: "Asia/Kolkata" },
          location: meeting.location ?? undefined,
        }
      } else {
        eventPayload = {
          summary: meeting.title,
          description: `View in ProjectFlow: ${appUrl}/dashboard/projects/${meeting.project_id}/meetings`,
          start: { date: meeting.meeting_date },
          end: { date: meeting.meeting_date },
          location: meeting.location ?? undefined,
        }
      }
    } else if (sourceType === "invoice_due_date") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoice } = await (supabase.from as any)("invoices")
        .select("id, invoice_number, due_date, project_id, client_id")
        .eq("id", sourceId)
        .eq("studio_id", studioId)
        .maybeSingle()

      if (!invoice?.due_date) return

      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", invoice.client_id)
        .maybeSingle()

      projectId = invoice.project_id
      eventPayload = {
        summary: `Invoice ${invoice.invoice_number} due — ${client?.name ?? ""}`,
        description: `View in ProjectFlow: ${appUrl}/dashboard/projects/${invoice.project_id}/finance`,
        start: { date: invoice.due_date },
        end: { date: invoice.due_date },
      }
    } else if (sourceType === "site_visit") {
      // site_visit uses meetings table with meeting_type = 'site_visit'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: meeting } = await (supabase.from as any)("meetings")
        .select("id, title, meeting_date, start_time, end_time, location, project_id")
        .eq("id", sourceId)
        .eq("studio_id", studioId)
        .maybeSingle()

      if (!meeting) return

      projectId = meeting.project_id
      eventPayload = {
        summary: meeting.title,
        description: `View in ProjectFlow: ${appUrl}/dashboard/projects/${meeting.project_id}/meetings`,
        start: { date: meeting.meeting_date },
        end: { date: meeting.meeting_date },
        location: meeting.location ?? undefined,
      }
    }

    if (!eventPayload) return

    // Compute hash
    const hashInput = {
      title: eventPayload.summary as string,
      start: JSON.stringify(eventPayload.start),
      end: JSON.stringify(eventPayload.end),
      location: (eventPayload.location as string) ?? "",
    }
    const hash = buildEventHash(hashInput.title, hashInput.start, hashInput.end, hashInput.location)

    // Check existing link
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from as any)("calendar_event_links")
      .select("id, google_event_id, last_pushed_hash")
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .maybeSingle()

    const calendarId = (conn.google_calendar_id as string) || "primary"

    if (existing) {
      if (existing.last_pushed_hash === hash) return // unchanged — skip

      // PATCH existing event
      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${existing.google_event_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      )

      if (patchRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from as any)("calendar_event_links")
          .update({ last_pushed_hash: hash, last_pushed_at: new Date().toISOString() })
          .eq("id", existing.id)
      }
    } else {
      // POST new event
      const postRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      )

      if (postRes.ok) {
        const created = await postRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from as any)("calendar_event_links")
          .insert({
            studio_id: studioId,
            user_id: userId,
            source_type: sourceType,
            source_id: sourceId,
            project_id: projectId,
            google_event_id: created.id,
            last_pushed_hash: hash,
            last_pushed_at: new Date().toISOString(),
          })
      }
    }
  } catch (err) {
    console.error(`pushToGoogleCalendar(${sourceType}, ${sourceId}) error:`, err)
  }
}

// ─── removeFromGoogleCalendar ─────────────────────────────────────────────────
// Fire-and-forget — NEVER throws.

export async function removeFromGoogleCalendar(
  sourceType: PushableSourceType,
  sourceId: string,
  userId?: string
): Promise<void> {
  try {
    const ctx = await getAuthContext()
    const targetUserId = userId ?? ctx.userId
    const supabase = ctx.supabase

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: link } = await (supabase.from as any)("calendar_event_links")
      .select("id, google_event_id")
      .eq("user_id", targetUserId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .maybeSingle()

    if (!link) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conn } = await (supabase.from as any)("calendar_connections")
      .select("access_token, refresh_token, token_expiry, google_calendar_id, is_active")
      .eq("user_id", targetUserId)
      .maybeSingle()

    if (conn?.is_active) {
      const accessToken = await ensureFreshToken(conn)
      const calendarId = (conn.google_calendar_id as string) || "primary"

      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${link.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
    }

    // Delete link regardless of whether API call succeeded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)("calendar_event_links")
      .delete()
      .eq("id", link.id)
  } catch (err) {
    console.error(`removeFromGoogleCalendar(${sourceType}, ${sourceId}) error:`, err)
  }
}

// ─── syncCalendarFromGoogle ───────────────────────────────────────────────────

export async function syncCalendarFromGoogle(): Promise<{ synced: number }> {
  const { supabase, userId, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase.from as any)("calendar_connections")
    .select("id, access_token, refresh_token, token_expiry, is_active")
    .eq("user_id", userId)
    .maybeSingle()

  if (!conn || !conn.is_active) return { synced: 0 }

  const accessToken = await ensureFreshToken(conn)

  const now = new Date()
  const timeMin = now.toISOString()
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const events = await fetchGoogleCalendarEvents(accessToken, timeMin, timeMax)

  // Exclude events ProjectFlow pushed (avoid double-counting as "busy")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pfLinks } = await (supabase.from as any)("calendar_event_links")
    .select("google_event_id")
    .eq("user_id", userId)

  const pfEventIds = new Set(
    ((pfLinks ?? []) as Array<{ google_event_id: string }>).map((l) => l.google_event_id)
  )

  const externalEvents = events.filter(
    (e) => !pfEventIds.has(e.id) && e.status !== "cancelled"
  )

  // Replace busy blocks for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("calendar_busy_blocks")
    .delete()
    .eq("user_id", userId)

  const insertRows = externalEvents
    .filter((e) => e.start && e.end)
    .map((e) => {
      const isAllDay = !e.start?.dateTime
      const startAt = e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`
      const endAt = e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`

      return {
        studio_id: studioId,
        user_id: userId,
        google_event_id: e.id,
        title: e.summary ?? null,
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        synced_at: new Date().toISOString(),
      }
    })

  if (insertRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)("calendar_busy_blocks")
      .insert(insertRows)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("calendar_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", conn.id)

  revalidatePath("/dashboard/team")

  return { synced: insertRows.length }
}

// ─── getResourceAllocationCalendar ───────────────────────────────────────────

export async function getResourceAllocationCalendar(
  startDate: string,
  endDate: string
): Promise<BusyBlock[]> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { hasPermission } = await import("@/lib/permissions")
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (!hasPermission(userRow?.role ?? "designer", "manage_team")) {
    throw new Error("Insufficient permissions")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blocks } = await (supabase.from as any)("calendar_busy_blocks")
    .select("id, user_id, title, start_at, end_at, is_all_day")
    .eq("studio_id", studioId)
    .gte("start_at", startDate)
    .lte("end_at", endDate)

  if (!blocks?.length) return []

  // Fetch user names
  const userIds = [...new Set((blocks as Array<{ user_id: string }>).map((b) => b.user_id))]
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", userIds)

  const userNameMap: Record<string, string> = {}
  for (const u of users ?? []) userNameMap[u.id] = u.name

  return (blocks as Array<{
    id: string
    user_id: string
    title: string | null
    start_at: string
    end_at: string
    is_all_day: boolean
  }>).map((b) => ({
    id: b.id,
    user_id: b.user_id,
    user_name: userNameMap[b.user_id],
    // Privacy: only reveal title for the requesting user's own blocks
    title: b.user_id === userId ? b.title : null,
    start_at: b.start_at,
    end_at: b.end_at,
    is_all_day: b.is_all_day,
    is_own: b.user_id === userId,
  }))
}

// ─── getResourceConflicts ─────────────────────────────────────────────────────

export async function getResourceConflicts(
  startDate: string,
  endDate: string
): Promise<ResourceConflict[]> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { hasPermission } = await import("@/lib/permissions")
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (!hasPermission(userRow?.role ?? "designer", "manage_team")) {
    throw new Error("Insufficient permissions")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meetings } = await (supabase.from as any)("meetings")
    .select("id, title, meeting_date, meeting_type, project_id, projects(name)")
    .eq("studio_id", studioId)
    .gte("meeting_date", startDate.split("T")[0])
    .lte("meeting_date", endDate.split("T")[0])

  if (!meetings?.length) return []

  const conflicts: ResourceConflict[] = []

  for (const meeting of meetings as Array<{
    id: string
    title: string
    meeting_date: string
    meeting_type: string
    project_id: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any
  }>) {
    const projectName = meeting.projects?.name ?? ""
    const pfEventTitle = `${meeting.title} — ${projectName}`
    const pfEventType: ResourceConflict["pf_event_type"] =
      meeting.meeting_type === "site_visit" ? "site_visit" : "meeting"

    // Fetch team members assigned to this project
    const { data: members } = await supabase
      .from("project_members")
      .select("user_id, users(id, name)")
      .eq("project_id", meeting.project_id)

    for (const member of members ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberId = (member as any).user_id as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberName = (member as any).users?.name ?? "Team member"

      // Check busy blocks on same date
      const dayStart = `${meeting.meeting_date}T00:00:00Z`
      const dayEnd = `${meeting.meeting_date}T23:59:59Z`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: busyRows } = await (supabase.from as any)("calendar_busy_blocks")
        .select("start_at, end_at")
        .eq("user_id", memberId)
        .eq("studio_id", studioId)
        .gte("start_at", dayStart)
        .lte("start_at", dayEnd)
        .limit(1)

      if (busyRows?.length) {
        conflicts.push({
          user_id: memberId,
          user_name: memberName,
          conflict_date: meeting.meeting_date,
          pf_event_title: pfEventTitle,
          pf_event_type: pfEventType,
          busy_block_start: busyRows[0].start_at,
          busy_block_end: busyRows[0].end_at,
        })
      }
    }
  }

  return conflicts
}
