import { NextRequest, NextResponse } from "next/server"
import { clientApproveMoodboard, clientRequestRevision } from "@/app/actions/moodboards"

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { share_token, action, name, feedback } = body as {
    share_token?: string
    action?: string
    name?: string
    feedback?: string
  }

  if (!share_token || !action || !name) {
    return NextResponse.json(
      { error: "share_token, action, and name are required" },
      { status: 400 }
    )
  }

  if (action !== "approve" && action !== "request_revision") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'request_revision'" },
      { status: 400 }
    )
  }

  if (action === "request_revision" && !feedback) {
    return NextResponse.json(
      { error: "feedback is required when requesting a revision" },
      { status: 400 }
    )
  }

  try {
    if (action === "approve") {
      await clientApproveMoodboard(share_token, name, feedback)
    } else {
      await clientRequestRevision(share_token, feedback!, name)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (message.includes("not found") || message.includes("not available")) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
