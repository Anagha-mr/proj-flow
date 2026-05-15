"use server"

import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"

export async function updateStudioIntegrations(payload: {
  wati_api_url?: string | null
  wati_api_key?: string | null
  resend_api_key?: string | null
  sending_email?: string | null
  sending_email_name?: string | null
}): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner") throw new Error("Only owners can update integrations")

  const { error } = await supabase
    .from("studios")
    .update({
      wati_api_url: payload.wati_api_url ?? null,
      wati_api_key: payload.wati_api_key ?? null,
      resend_api_key: payload.resend_api_key ?? null,
      sending_email: payload.sending_email ?? null,
      sending_email_name: payload.sending_email_name ?? null,
    })
    .eq("id", studioId)

  if (error) throw new Error(error.message)
}

export async function testWatiConnection(studioId: string): Promise<{ ok: boolean; message: string }> {
  const { role } = await getAuthContext()
  if (role !== "owner") throw new Error("Only owners can test integrations")

  try {
    const supabase = createServiceClient()
    const { data: studio } = await supabase
      .from("studios")
      .select("wati_api_url, wati_api_key, whatsapp_number")
      .eq("id", studioId)
      .single()

    if (!studio?.wati_api_url || !studio?.wati_api_key) {
      return { ok: false, message: "WATI credentials not saved yet" }
    }
    if (!studio.whatsapp_number) {
      return { ok: false, message: "No WhatsApp number set on studio profile" }
    }

    const res = await fetch(`https://${studio.wati_api_url}/api/v1/getContacts?pageSize=1`, {
      headers: { Authorization: `Bearer ${studio.wati_api_key}` },
    })

    return res.ok
      ? { ok: true, message: "Connected successfully" }
      : { ok: false, message: `WATI returned ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

export async function testResendEmail(studioId: string): Promise<{ ok: boolean; message: string }> {
  const { supabase, role } = await getAuthContext()
  if (role !== "owner") throw new Error("Only owners can test integrations")

  try {
    const { data: studio } = await supabase
      .from("studios")
      .select("resend_api_key, sending_email, sending_email_name")
      .eq("id", studioId)
      .single()

    if (!studio?.resend_api_key || !studio?.sending_email) {
      return { ok: false, message: "Resend credentials not saved yet" }
    }

    // Fetch owner email
    const { data: owner } = await supabase
      .from("users")
      .select("email")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()

    if (!owner?.email) return { ok: false, message: "Could not find owner email" }

    const { Resend } = await import("resend")
    const resend = new Resend(studio.resend_api_key)

    const fromName = studio.sending_email_name ?? "ProjectFlow"
    const { error } = await resend.emails.send({
      from: `${fromName} <${studio.sending_email}>`,
      to: owner.email,
      subject: "ProjectFlow — Resend connection test",
      html: "<p>Your Resend integration is working correctly.</p>",
    })

    return error
      ? { ok: false, message: error.message }
      : { ok: true, message: `Test email sent to ${owner.email}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
