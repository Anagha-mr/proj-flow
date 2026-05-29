import { NextRequest, NextResponse } from 'next/server'
import { recalculateAllProjectHealthScores } from '@/app/actions/health'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await recalculateAllProjectHealthScores()
    return NextResponse.json({ ok: true, recalculated_at: new Date().toISOString() })
  } catch (err) {
    console.error('Health score cron failed:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
