// POST /api/stage-payment/confirm
// Public route — no auth required. Contractor confirms payment receipt via token.

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(req: NextRequest) {
  let body: { stage_payment_id?: string; contractor_token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { stage_payment_id, contractor_token } = body

  if (!stage_payment_id || !contractor_token) {
    return NextResponse.json(
      { error: "stage_payment_id and contractor_token are required" },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Fetch stage payment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment } = await (supabase.from as any)("stage_payments")
    .select("id, status, contractor_id, studio_id, project_id, contractor_confirmed_at")
    .eq("id", stage_payment_id)
    .single() as {
    data: {
      id: string
      status: string
      contractor_id: string
      studio_id: string
      project_id: string
      contractor_confirmed_at: string | null
    } | null
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  // Verify token and expiry
  const { data: contractor } = await supabase
    .from("contractors")
    .select("contractor_token, contractor_token_expires_at")
    .eq("id", payment.contractor_id)
    .single()

  if (!contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 })
  }

  const cont = contractor as Record<string, unknown>

  if (cont.contractor_token !== contractor_token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 })
  }

  if (
    cont.contractor_token_expires_at &&
    new Date(cont.contractor_token_expires_at as string) < new Date()
  ) {
    return NextResponse.json({ error: "Token expired" }, { status: 403 })
  }

  if (payment.status !== "released") {
    return NextResponse.json(
      { error: "Payment is not in released status" },
      { status: 400 }
    )
  }

  if (payment.contractor_confirmed_at) {
    // Already confirmed — idempotent
    return NextResponse.json({ ok: true })
  }

  // Confirm receipt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)("stage_payments")
    .update({
      contractor_confirmed_at: new Date().toISOString(),
      status: "confirmed",
    })
    .eq("id", stage_payment_id)

  if (error) {
    console.error("Stage payment confirm error:", error)
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 })
  }

  // Notify studio owner (fire-and-forget)
  import("@/app/actions/notifications")
    .then(({ notifyStagePaymentConfirmed }) => {
      notifyStagePaymentConfirmed(stage_payment_id).catch(() => {})
    })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
