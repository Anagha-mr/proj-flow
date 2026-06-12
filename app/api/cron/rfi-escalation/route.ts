// Runs daily at 9:00am IST = 3:30am UTC
// Schedule: "30 3 * * *"
// Escalates open RFIs whose response_deadline has passed

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { notifyRFIEscalated } from "@/app/actions/notifications"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Fetch all open RFIs past their deadline with no escalation yet
  const { data: rfis, error } = await supabase
    .from("rfis")
    .select("id")
    .eq("status", "open")
    .lt("response_deadline", now)
    .is("escalated_at", null)

  if (error) {
    console.error("RFI escalation query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rfis || rfis.length === 0) {
    console.log("RFI escalation: no overdue RFIs found")
    return NextResponse.json({ ok: true, escalated: 0 })
  }

  const ids = rfis.map((r: { id: string }) => r.id)

  // Bulk update to escalated
  const { error: updateError } = await supabase
    .from("rfis")
    .update({ escalated_at: now, status: "escalated" })
    .in("id", ids)

  if (updateError) {
    console.error("RFI escalation update error:", updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Fire-and-forget notifications
  for (const rfi of rfis) {
    notifyRFIEscalated(rfi.id).catch(() => {})
  }

  console.log(`RFI escalation: escalated ${ids.length} RFIs`)
  return NextResponse.json({ ok: true, escalated: ids.length })
}
