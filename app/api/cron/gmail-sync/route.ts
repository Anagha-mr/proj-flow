// Daily Gmail sync cron — 9:10am IST = 3:40am UTC
// Schedule: "40 3 * * *"
// Iterates all active gmail_connections, runs classification, cleans expired suggestions

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  // 1. Clean up expired suggestions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: expiredDeleted } = await (supabase.from as any)("ai_suggestions")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString())

  // 2. Fetch all active gmail_connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connections, error } = await (supabase.from as any)("gmail_connections")
    .select("id, studio_id, user_id")
    .eq("is_active", true)

  if (error) {
    console.error("gmail-sync cron: connection query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allConnections = (connections ?? []) as Array<{ id: string; studio_id: string; user_id: string }>

  if (allConnections.length === 0) {
    return NextResponse.json({
      studios_synced: 0,
      suggestions_created: 0,
      expired_deleted: expiredDeleted ?? 0,
    })
  }

  let totalInserted = 0
  let studiosSynced = 0

  // 3. Sync each connection
  for (const conn of allConnections) {
    try {
      const res = await fetch(`${appUrl}/api/gmail/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ studioId: conn.studio_id, userId: conn.user_id }),
      })

      if (res.ok) {
        const data = await res.json()
        totalInserted += data.inserted ?? 0
        studiosSynced++
      } else {
        console.error(`gmail-sync cron: sync failed for user ${conn.user_id}:`, res.status)
      }
    } catch (err) {
      console.error(`gmail-sync cron: error for user ${conn.user_id}:`, err)
    }
  }

  console.log(
    `gmail-sync cron: synced ${studiosSynced} studios, inserted ${totalInserted} suggestions, deleted ${expiredDeleted ?? 0} expired`
  )

  return NextResponse.json({
    studios_synced: studiosSynced,
    suggestions_created: totalInserted,
    expired_deleted: expiredDeleted ?? 0,
  })
}
