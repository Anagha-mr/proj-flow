// Runs daily at 9:00am IST = 3:30am UTC
// Schedule: "30 3 * * *"

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendPaymentReminder } from "@/app/actions/payments"
import { differenceInDays } from "date-fns"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // Fetch all unpaid invoices across all studios where reminders are not paused
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invoices } = await (supabase.from as any)("invoices")
      .select("id, studio_id, due_date, reminders_paused, status")
      .in("status", ["sent", "partially_paid", "partial", "overdue"])
      .eq("reminders_paused", false) as { data: Record<string, unknown>[] | null }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let sent = 0

    for (const invoice of invoices ?? []) {
      const inv = invoice as Record<string, unknown>
      if (!inv.due_date) continue

      const dueDate = new Date(inv.due_date as string)
      dueDate.setHours(0, 0, 0, 0)

      const daysToDue = differenceInDays(dueDate, today)
      const daysOverdue = differenceInDays(today, dueDate)

      let reminderType: string | null = null

      if (daysToDue === 3) reminderType = "reminder_3_days_before"
      else if (daysToDue === 0) reminderType = "reminder_due_today"
      else if (daysOverdue === 7) reminderType = "reminder_7_days_overdue"
      else if (daysOverdue === 14) reminderType = "reminder_14_days_overdue"
      else if (daysOverdue === 30) reminderType = "reminder_30_days_overdue"

      if (!reminderType) continue

      // Idempotency: check if this reminder type was already sent for this invoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from as any)("payment_reminders")
        .select("id")
        .eq("invoice_id", inv.id as string)
        .eq("reminder_type", reminderType)
        .maybeSingle() as { data: { id: string } | null }

      if (existing) continue

      try {
        await sendPaymentReminder(inv.id as string, reminderType)
        console.log("Reminder sent:", inv.id, reminderType)
        sent++
      } catch (err) {
        console.error(`Reminder failed for invoice ${inv.id as string}:`, err)
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      run_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error("payment-reminders cron failed:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
