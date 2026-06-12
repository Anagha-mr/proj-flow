// Daily Calendar sync cron — 9:15am IST = 3:45am UTC
// Schedule: "45 3 * * *"
// Pulls Google Calendar busy blocks for all active connections, runs conflict detection

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  refreshGoogleToken,
  fetchGoogleCalendarEvents,
} from "@/lib/utils/calendar-sync-core"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Fetch all active calendar_connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connections, error } = await (supabase.from as any)("calendar_connections")
    .select("id, studio_id, user_id, access_token, refresh_token, token_expiry, google_calendar_id")
    .eq("is_active", true)

  if (error) {
    console.error("calendar-sync cron: connection query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allConnections = (connections ?? []) as Array<{
    id: string
    studio_id: string
    user_id: string
    access_token: string
    refresh_token: string
    token_expiry: string
    google_calendar_id: string
  }>

  if (allConnections.length === 0) {
    return NextResponse.json({ connections_synced: 0, conflicts_found: 0 })
  }

  let connectionsSynced = 0

  const now = new Date()
  const timeMin = now.toISOString()
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const fiveMinMs = 5 * 60 * 1000

  // 2. Sync each connection
  for (const conn of allConnections) {
    try {
      // Refresh token if needed
      let accessToken = conn.access_token
      const expiry = new Date(conn.token_expiry).getTime()

      if (Date.now() + fiveMinMs > expiry) {
        const refreshed = await refreshGoogleToken(conn.refresh_token)
        if (refreshed) {
          accessToken = refreshed.access_token
          const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from as any)("calendar_connections")
            .update({ access_token: accessToken, token_expiry: newExpiry })
            .eq("id", conn.id)
        }
      }

      // Fetch events from Google
      const events = await fetchGoogleCalendarEvents(accessToken, timeMin, timeMax)

      // Exclude ProjectFlow-originated events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pfLinks } = await (supabase.from as any)("calendar_event_links")
        .select("google_event_id")
        .eq("user_id", conn.user_id)

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
        .eq("user_id", conn.user_id)

      const insertRows = externalEvents
        .filter((e) => e.start && e.end)
        .map((e) => {
          const isAllDay = !e.start?.dateTime
          const startAt = e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`
          const endAt = e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`
          return {
            studio_id: conn.studio_id,
            user_id: conn.user_id,
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
        await (supabase.from as any)("calendar_busy_blocks").insert(insertRows)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)("calendar_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", conn.id)

      connectionsSynced++
    } catch (err) {
      console.error(`calendar-sync cron: error for user ${conn.user_id}:`, err)
    }
  }

  // 3. Conflict detection — per studio
  const studioIds = [...new Set(allConnections.map((c) => c.studio_id))]
  let totalConflicts = 0

  const today = now.toISOString().split("T")[0]
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  for (const studioId of studioIds) {
    try {
      // Fetch upcoming meetings for the studio
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: meetings } = await (supabase.from as any)("meetings")
        .select("id, title, meeting_date, meeting_type, project_id")
        .eq("studio_id", studioId)
        .gte("meeting_date", today)
        .lte("meeting_date", in30Days)

      for (const meeting of meetings ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: members } = await (supabase.from as any)("project_members")
          .select("user_id")
          .eq("project_id", meeting.project_id)

        for (const member of members ?? []) {
          const dayStart = `${meeting.meeting_date}T00:00:00Z`
          const dayEnd = `${meeting.meeting_date}T23:59:59Z`

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: busyRows } = await (supabase.from as any)("calendar_busy_blocks")
            .select("id")
            .eq("user_id", member.user_id)
            .eq("studio_id", studioId)
            .gte("start_at", dayStart)
            .lte("start_at", dayEnd)
            .limit(1)

          if (busyRows?.length) {
            totalConflicts++

            // Notify studio owner (fire-and-forget stub)
            try {
              const { notifyResourceConflict } = await import("@/app/actions/notifications")
              const { data: user } = await supabase
                .from("users")
                .select("name")
                .eq("id", member.user_id)
                .single()

              notifyResourceConflict(studioId, {
                user_id: member.user_id,
                user_name: user?.name ?? "Team member",
                conflict_date: meeting.meeting_date,
                pf_event_title: meeting.title,
                pf_event_type: meeting.meeting_type === "site_visit" ? "site_visit" : "meeting",
                busy_block_start: dayStart,
                busy_block_end: dayEnd,
              }).catch(() => {})
            } catch {
              // ignore notification errors
            }
          }
        }
      }
    } catch (err) {
      console.error(`calendar-sync cron: conflict detection error for studio ${studioId}:`, err)
    }
  }

  console.log(
    `calendar-sync cron: synced ${connectionsSynced} connections, found ${totalConflicts} conflicts`
  )

  return NextResponse.json({ connections_synced: connectionsSynced, conflicts_found: totalConflicts })
}
