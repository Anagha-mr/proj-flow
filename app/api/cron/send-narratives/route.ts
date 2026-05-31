// Runs every Monday at 9:00am IST = 3:30am UTC
// Schedule: "30 3 * * 1"

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendNarrativeForCron } from "@/app/actions/narratives"
import { getMonday } from "@/lib/utils/date"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const weekStartDate = getMonday(today)

  const supabaseAdmin = createServiceClient()

  // Fetch all approved narratives for this week
  const { data: narratives } = await supabaseAdmin
    .from("weekly_narratives" as never)
    .select("id")
    .eq("status", "approved")
    .eq("week_start_date", weekStartDate) as { data: Array<{ id: string }> | null }

  if (!narratives?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  let sent = 0
  let failed = 0

  for (const narrative of narratives) {
    try {
      await sendNarrativeForCron(narrative.id, supabaseAdmin)
      sent++
      console.log(`Sent narrative ${narrative.id}`)
    } catch (err) {
      console.error(`Failed to send narrative ${narrative.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed, week: weekStartDate })
}

