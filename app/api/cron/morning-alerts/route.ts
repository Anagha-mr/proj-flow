import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyProjectHealthAlert } from '@/app/actions/notifications'
import type { HealthSignals } from '@/app/actions/dashboard'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()

    // Fetch projects that flipped to amber or red in the last 8 hours
    // (cast — health_score / health_signals / health_last_calculated_at added by sprint 16 migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects } = await (supabase.from as any)('projects')
      .select('id, health_score, health_signals')
      .in('health_score', ['amber', 'red'])
      .gte('health_last_calculated_at', eightHoursAgo) as {
        data: Array<{ id: string; health_score: string; health_signals: unknown }> | null
      }

    let notified = 0
    for (const project of projects ?? []) {
      try {
        await notifyProjectHealthAlert(project.id, project.health_signals as unknown as HealthSignals)
        notified++
      } catch (err) {
        console.error(`Morning alert failed for project ${project.id}:`, err)
      }
    }

    return NextResponse.json({ ok: true, notified, run_at: new Date().toISOString() })
  } catch (err) {
    console.error('Morning alerts cron failed:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
