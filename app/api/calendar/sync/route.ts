// Protected — manually triggered Calendar sync (called by [Sync now] button)
// Thin wrapper around syncCalendarFromGoogle() server action

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncCalendarFromGoogle } from "@/app/actions/calendar"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncCalendarFromGoogle()
    return NextResponse.json(result)
  } catch (err) {
    console.error("Calendar sync route error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
