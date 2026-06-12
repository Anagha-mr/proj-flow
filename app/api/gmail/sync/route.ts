// Protected — manually triggered Gmail sync (also called by cron)
// Fetches recent email metadata, classifies via Groq, inserts ai_suggestions
// Privacy-first: only reads metadata (From, Subject, Snippet) — never full body

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import {
  buildGmailClassificationPrompt,
  type EmailMetadata,
  type StudioContacts,
  type StudioContact,
} from "@/lib/utils/gmail-classify"

interface GmailMessage {
  id: string
}

interface GmailMessageDetail {
  id: string
  snippet?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  return res.json()
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  let studioId: string
  let userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbClient: any

  if (isCron) {
    // Cron passes studioId + userId in body
    const body = await req.json().catch(() => ({}))
    studioId = body.studioId
    userId = body.userId
    if (!studioId || !userId) {
      return NextResponse.json({ error: "Missing studioId/userId" }, { status: 400 })
    }
    dbClient = createServiceClient()
  } else {
    // Manual sync — validate session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("studio_id")
      .eq("id", user.id)
      .single()

    if (!profile?.studio_id) return NextResponse.json({ error: "No studio" }, { status: 401 })

    studioId = profile.studio_id
    userId = user.id
    dbClient = supabase
  }

  // 1. Fetch gmail_connections row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (dbClient.from as any)("gmail_connections")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ processed: 0, inserted: 0 })
  }

  // 2. Refresh token if expiring within 5 minutes
  let accessToken: string = conn.access_token
  const expiry = new Date(conn.token_expiry).getTime()
  const fiveMinMs = 5 * 60 * 1000

  if (Date.now() + fiveMinMs > expiry) {
    const refreshed = await refreshAccessToken(conn.refresh_token)
    if (refreshed) {
      accessToken = refreshed.access_token
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      const svc = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from as any)("gmail_connections")
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq("id", conn.id)
    }
  }

  // 3. Fetch last 20 inbox messages from today
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:inbox+newer_than:1d",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) {
    return NextResponse.json({ error: "Gmail API error", processed: 0, inserted: 0 }, { status: 502 })
  }

  const listData = await listRes.json()
  const messages: GmailMessage[] = listData.messages ?? []

  if (messages.length === 0) {
    return NextResponse.json({ processed: 0, inserted: 0 })
  }

  // 4. Check which message IDs already exist in ai_suggestions
  const svc = createServiceClient()
  const messageIds = messages.map((m) => m.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRows } = await (svc.from as any)("ai_suggestions")
    .select("source_reference")
    .eq("studio_id", studioId)
    .in("source_reference", messageIds)

  const existingRefs = new Set((existingRows ?? []).map((r: { source_reference: string }) => r.source_reference))

  const newMessageIds = messageIds.filter((id) => !existingRefs.has(id))
  if (newMessageIds.length === 0) {
    await (svc.from as any)("gmail_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", conn.id)
    return NextResponse.json({ processed: 0, inserted: 0 })
  }

  // 5. Fetch studio contacts (clients, vendors, contractors)
  const [clientsRes, vendorsRes, contractorsRes] = await Promise.all([
    dbClient.from("clients").select("id, name, email").eq("studio_id", studioId),
    dbClient.from("vendors").select("id, name, email").eq("studio_id", studioId),
    dbClient.from("contractors").select("id, contact_name, email, company_name").eq("studio_id", studioId),
  ])

  const clients: StudioContact[] = (clientsRes.data ?? []).map((c: Record<string, string>) => ({
    email: c.email,
    name: c.name,
    type: 'client' as const,
    project_ids: [],
    project_names: [],
  }))

  const vendors: StudioContact[] = (vendorsRes.data ?? []).map((v: Record<string, string>) => ({
    email: v.email,
    name: v.name,
    type: 'vendor' as const,
    project_ids: [],
    project_names: [],
  }))

  const contractors: StudioContact[] = (contractorsRes.data ?? []).map((c: Record<string, string>) => ({
    email: c.email,
    name: c.contact_name ?? c.company_name,
    type: 'contractor' as const,
    project_ids: [],
    project_names: [],
  }))

  const contacts: StudioContacts = { clients, vendors, contractors }

  const knownEmails = new Set([
    ...clients.map((c) => c.email?.toLowerCase()).filter(Boolean),
    ...vendors.map((c) => c.email?.toLowerCase()).filter(Boolean),
    ...contractors.map((c) => c.email?.toLowerCase()).filter(Boolean),
  ])

  // 6. Fetch message metadata (From, Subject) and filter to known contacts
  const filteredEmails: EmailMetadata[] = []

  const batchFetches = newMessageIds.slice(0, 20).map(async (id) => {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=METADATA&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return
    const detail: GmailMessageDetail = await res.json()

    const headers = detail.payload?.headers ?? []
    const fromHeader = headers.find((h) => h.name === "From")?.value ?? ""
    const subject = headers.find((h) => h.name === "Subject")?.value ?? ""

    // Parse "Name <email>" or just "email"
    const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s]+@[^\s]+)/)
    const fromEmail = emailMatch?.[1]?.toLowerCase() ?? ""
    const fromName = fromHeader.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || fromEmail

    if (!fromEmail || !knownEmails.has(fromEmail)) return

    filteredEmails.push({
      message_id: id,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      snippet: detail.snippet ?? "",
    })
  })

  await Promise.all(batchFetches)

  if (filteredEmails.length === 0) {
    await (svc.from as any)("gmail_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", conn.id)
    return NextResponse.json({ processed: newMessageIds.length, inserted: 0 })
  }

  // 7. Batch classify via Groq (up to 10 at a time)
  const batch = filteredEmails.slice(0, 10)
  const prompt = buildGmailClassificationPrompt(batch, contacts)

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  })

  if (!groqRes.ok) {
    console.error("Groq classification error:", await groqRes.text())
    return NextResponse.json({ error: "Classification failed", processed: 0, inserted: 0 }, { status: 502 })
  }

  const groqData = await groqRes.json()
  const rawContent = groqData.choices?.[0]?.message?.content ?? "{}"

  let classificationResults: Array<Record<string, unknown>> = []
  try {
    const parsed = JSON.parse(rawContent)
    classificationResults = Array.isArray(parsed.results) ? parsed.results : []
  } catch {
    classificationResults = []
  }

  // 8. Insert classified suggestions
  const now = new Date().toISOString()
  const insertRows: Record<string, unknown>[] = []

  for (const result of classificationResults) {
    const msgId = result.message_id as string
    const email = batch.find((e) => e.message_id === msgId)
    if (!email) continue

    insertRows.push({
      studio_id: studioId,
      user_id: userId,
      project_id: (result.project_id as string) ?? null,
      source_type: 'gmail',
      source_reference: msgId,
      sender_email: email.from_email,
      sender_name: email.from_name,
      email_subject: email.subject,
      email_snippet: email.snippet,
      classification: result.classification ?? 'general',
      suggested_action_type: result.suggested_action_type ?? 'no_action',
      suggested_action_data: result.suggested_action_data ?? {},
      status: 'pending',
      created_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  let inserted = 0
  if (insertRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (svc.from as any)("ai_suggestions").insert(insertRows)
    if (!insertError) inserted = insertRows.length
    else console.error("ai_suggestions insert error:", insertError)
  }

  // 9. Update last_sync_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from as any)("gmail_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", conn.id)

  return NextResponse.json({ processed: batch.length, inserted })
}
