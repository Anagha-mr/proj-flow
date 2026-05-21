import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CANVA_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })

  const rawBody = await request.text()
  const signature = request.headers.get("canva-signature") ?? ""

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex")

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = payload.event_type as string | undefined

  if (eventType === "design.export.completed") {
    const designId = (payload.design_id ?? (payload.design as Record<string, unknown>)?.id) as string | undefined
    const exportUrl = (payload.export_url ?? (payload.export as Record<string, unknown>)?.url) as string | undefined
    const thumbnailUrl = (payload.thumbnail_url ?? (payload.thumbnail as Record<string, unknown>)?.url) as string | undefined

    if (designId && exportUrl) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const updates: Record<string, string> = { canva_export_url: exportUrl }
        if (thumbnailUrl) updates.thumbnail_url = thumbnailUrl

        await supabase
          .from("moodboards")
          .update(updates)
          .eq("canva_design_id", designId)
      } catch {
        // silent — return 200 so Canva doesn't retry
      }
    }

    return NextResponse.json({ ok: true })
  }

  // Recognised shape but unknown event type
  if (eventType) return NextResponse.json({ ok: true })

  return NextResponse.json({ error: "Unrecognised payload shape" }, { status: 400 })
}
