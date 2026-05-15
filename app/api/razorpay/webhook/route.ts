import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("razorpay-signature") ?? ""

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex")

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  console.log("Razorpay webhook:", event.event, event.payload)

  const supabase = createServiceClient()

  if (event.event === "payment.captured") {
    const subscriptionId = event.payload?.payment?.entity?.subscription_id
    const planTier = event.payload?.payment?.entity?.notes?.plan_tier

    if (subscriptionId && planTier) {
      const validTiers = ["starter", "pro", "scale"]
      if (validTiers.includes(planTier)) {
        await supabase
          .from("studios")
          .update({ plan_tier: planTier })
          .eq("id", event.payload?.payment?.entity?.notes?.studio_id ?? "")
      }
    }
  }

  if (event.event === "subscription.cancelled") {
    const studioId = event.payload?.subscription?.entity?.notes?.studio_id
    if (studioId) {
      await supabase
        .from("studios")
        .update({ plan_tier: "starter" })
        .eq("id", studioId)
    }
  }

  return NextResponse.json({ received: true })
}
