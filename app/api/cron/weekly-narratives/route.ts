// Runs every Monday at 8:50am IST = 3:20am UTC
// Schedule: "20 3 * * 1"

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { generateNarrativeDraftForCron } from "@/app/actions/narratives"
import { getMonday } from "@/lib/utils/date"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const weekStartDate = getMonday(today)

  const supabaseAdmin = createServiceClient()

  // Fetch all active projects where narrative_frequency != 'paused' and has a client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabaseAdmin.from as any)("projects")
    .select("id, studio_id, client_id, narrative_frequency, narrative_language, health_score")
    .in("status", ["active", "in_progress"])
    .not("client_id", "is", null) as { data: Array<{
      id: string
      studio_id: string
      client_id: string
      narrative_frequency: string | null
      narrative_language: string | null
      health_score: string | null
    }> | null }

  if (!projects?.length) {
    return NextResponse.json({ ok: true, generated: 0 })
  }

  // Filter out paused and apply biweekly logic
  const weekNumber = getWeekNumber(today)
  const eligibleProjects = projects.filter((p) => {
    if (p.narrative_frequency === 'paused') return false
    if (p.narrative_frequency === 'biweekly') return weekNumber % 2 === 0
    return true
  })

  let generated = 0
  let failed = 0

  for (const project of eligibleProjects) {
    try {
      // Idempotency check
      const { data: existing } = await supabaseAdmin
        .from("weekly_narratives" as never)
        .select("id, status")
        .eq("project_id", project.id)
        .eq("week_start_date", weekStartDate)
        .maybeSingle()

      if (existing) {
        console.log(`Narrative already exists for ${project.id} week ${weekStartDate} — skipping`)
        continue
      }

      await generateNarrativeDraftForCron(
        project.id,
        project.studio_id,
        weekStartDate,
        supabaseAdmin
      )
      generated++
      console.log(`Generated narrative for project ${project.id}`)
    } catch (err) {
      console.error(`Failed to generate narrative for ${project.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, generated, failed, week: weekStartDate })
}

function getWeekNumber(date: Date): number {
  const oneJan = new Date(date.getFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}
