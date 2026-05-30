import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature =
    req.headers.get("x-razorpay-signature") ??
    req.headers.get("razorpay-signature") ??
    ""

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const payload = event.payload as Record<string, unknown>

  // ─── Extract identifiers from payload notes ───────────────────────────────
  const paymentEntity = (payload?.payment as Record<string, unknown>)
    ?.entity as Record<string, unknown> | undefined
  const paymentLinkEntity = (payload?.payment_link as Record<string, unknown>)
    ?.entity as Record<string, unknown> | undefined
  const notes = (
    (paymentEntity?.notes ?? paymentLinkEntity?.notes) as Record<string, string> | undefined
  )

  const studioId: string | undefined = notes?.studio_id
  const invoiceId: string | undefined = notes?.invoice_id

  // ─── Per-studio signature verification ────────────────────────────────────
  let webhookSecret: string | null = null
  if (studioId) {
    const { data: studio } = await (supabase.from as AnyQuery)("studios")
      .select("razorpay_webhook_secret")
      .eq("id", studioId)
      .single() as { data: { razorpay_webhook_secret: string | null } | null }
    webhookSecret = studio?.razorpay_webhook_secret ?? null
  }
  if (!webhookSecret) {
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? null
  }

  if (webhookSecret && signature) {
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex")
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  }

  console.log("Razorpay webhook:", event.event)

  // ─── payment_link.paid ────────────────────────────────────────────────────

  if (event.event === "payment_link.paid") {
    const paymentId = paymentEntity?.id as string | undefined
    const amountPaid = (
      paymentLinkEntity?.amount_paid ?? paymentLinkEntity?.amount
    ) as number | undefined

    if (!invoiceId) return NextResponse.json({ received: true })

    if (paymentId) {
      const { data: existing } = await (supabase.from as AnyQuery)("invoice_payments")
        .select("id")
        .eq("invoice_id", invoiceId)
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle() as { data: { id: string } | null }
      if (existing) return NextResponse.json({ received: true })
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, studio_id, client_id, project_id, total, invoice_number")
      .eq("id", invoiceId)
      .single()
    if (!invoice) return NextResponse.json({ received: true })

    // Insert payment record
    await (supabase.from as AnyQuery)("invoice_payments")
      .insert({
        invoice_id: invoiceId,
        studio_id: invoice.studio_id,
        amount: (amountPaid ?? 0) / 100,
        payment_date: new Date().toISOString().split("T")[0],
        razorpay_payment_id: paymentId ?? null,
        payment_source: "razorpay_webhook",
        notes: "Auto-recorded via Razorpay payment link",
      })

    // Mark invoice paid
    await (supabase.from as AnyQuery)("invoices")
      .update({ status: "paid", razorpay_payment_link_status: "paid" })
      .eq("id", invoiceId)
      .eq("studio_id", invoice.studio_id)

    // Log idempotency marker
    await (supabase.from as AnyQuery)("payment_reminders")
      .insert({
        studio_id: invoice.studio_id,
        invoice_id: invoiceId,
        reminder_type: "invoice_sent",
        sent_at: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {})

    // Send WhatsApp receipt (fire-and-forget)
    try {
      const [clientRes, projectRes, studioRes] = await Promise.all([
        supabase
          .from("clients")
          .select("name, whatsapp_number")
          .eq("id", invoice.client_id)
          .single(),
        supabase
          .from("projects")
          .select("name")
          .eq("id", invoice.project_id)
          .single(),
        (supabase.from as AnyQuery)("studios")
          .select("wati_api_url, wati_api_key")
          .eq("id", invoice.studio_id)
          .single() as Promise<{
          data: { wati_api_url: string | null; wati_api_key: string | null } | null
        }>,
      ])

      const client = clientRes.data
      const project = projectRes.data
      const studio = studioRes.data

      if (
        client?.whatsapp_number &&
        studio?.wati_api_url &&
        studio?.wati_api_key
      ) {
        const amountFormatted = ((amountPaid ?? 0) / 100).toLocaleString(
          "en-IN",
          { style: "currency", currency: "INR", maximumFractionDigits: 0 }
        )
        await fetch(
          `https://${studio.wati_api_url}/api/v1/sendTemplateMessage`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${studio.wati_api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              whatsappNumber: client.whatsapp_number,
              template_name: "payment_received",
              broadcast_name: "payment_received",
              parameters: [
                { name: "1", value: client.name },
                { name: "2", value: amountFormatted },
                { name: "3", value: project?.name ?? "" },
                { name: "4", value: "₹0" },
                { name: "5", value: paymentId ?? "" },
              ],
            }),
          }
        ).catch(() => {})
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json({ received: true })
  }

  // ─── payment.captured ─────────────────────────────────────────────────────
  // Preserved from Sprint 6

  if (event.event === "payment.captured") {
    const subscriptionId = paymentEntity?.subscription_id as string | undefined
    const planTier = (paymentEntity?.notes as Record<string, string> | undefined)
      ?.plan_tier

    if (subscriptionId && planTier) {
      const validTiers = ["starter", "pro", "scale"]
      if (validTiers.includes(planTier)) {
        await supabase
          .from("studios")
          .update({ plan_tier: planTier as "starter" | "pro" | "scale" })
          .eq(
            "id",
            (paymentEntity?.notes as Record<string, string> | undefined)
              ?.studio_id ?? ""
          )
      }
    }

    if (invoiceId && !subscriptionId) {
      const capturedAmount = paymentEntity?.amount as number | undefined
      const capturedPaymentId = paymentEntity?.id as string | undefined

      if (capturedAmount && invoiceId) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id, studio_id, total")
          .eq("id", invoiceId)
          .single()

        if (invoice) {
          if (capturedPaymentId) {
            const { data: existing } = await (supabase.from as AnyQuery)("invoice_payments")
              .select("id")
              .eq("invoice_id", invoiceId)
              .eq("razorpay_payment_id", capturedPaymentId)
              .maybeSingle() as { data: { id: string } | null }

            if (!existing) {
              await (supabase.from as AnyQuery)("invoice_payments")
                .insert({
                  invoice_id: invoiceId,
                  studio_id: invoice.studio_id,
                  amount: capturedAmount / 100,
                  payment_date: new Date().toISOString().split("T")[0],
                  razorpay_payment_id: capturedPaymentId,
                  payment_source: "razorpay_webhook",
                })
            }
          }

          const { data: payments } = await supabase
            .from("invoice_payments")
            .select("amount")
            .eq("invoice_id", invoiceId)
          const totalPaid = (payments ?? []).reduce(
            (sum, p) => sum + p.amount,
            0
          )
          const newStatus =
            totalPaid >= invoice.total ? "paid" : "partially_paid"
          await (supabase.from as AnyQuery)("invoices")
            .update({ status: newStatus })
            .eq("id", invoiceId)
            .eq("studio_id", invoice.studio_id)
        }
      }
    }
  }

  // ─── subscription.cancelled ───────────────────────────────────────────────

  if (event.event === "subscription.cancelled") {
    const subStudioId = (
      (payload?.subscription as Record<string, unknown>)
        ?.entity as Record<string, unknown>
    )?.notes as Record<string, string> | undefined
    if (subStudioId?.studio_id) {
      await supabase
        .from("studios")
        .update({ plan_tier: "starter" })
        .eq("id", subStudioId.studio_id)
    }
  }

  return NextResponse.json({ received: true })
}
