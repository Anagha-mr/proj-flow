"use server"

import { createServiceClient } from "@/lib/supabase/service"

async function getWatiCredentials(studioId: string): Promise<{ url: string; key: string } | null> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from("studios")
      .select("wati_api_url, wati_api_key")
      .eq("id", studioId)
      .single()

    if (data?.wati_api_url && data?.wati_api_key) {
      return { url: data.wati_api_url, key: data.wati_api_key }
    }
  } catch {
    // fall through to env var fallback
  }

  // Env var fallback for dev/test
  const url = process.env.WATI_API_URL
  const key = process.env.WATI_API_KEY
  if (url && key) return { url, key }

  return null
}

export async function sendWhatsAppMessage(params: {
  to: string
  templateName: string
  variables: Record<string, string>
  studioId: string
  recipientType: 'client' | 'contractor' | 'vendor' | 'user'
  recipientId: string
  projectId?: string
}): Promise<void> {
  const supabase = createServiceClient()

  try {
    const creds = await getWatiCredentials(params.studioId)

    if (!creds) {
      console.warn(`WATI credentials not configured for studio ${params.studioId} — skipping WhatsApp send`)
      return
    }

    const body = {
      whatsappNumber: params.to,
      template_name: params.templateName,
      broadcast_name: params.templateName,
      parameters: Object.entries(params.variables).map(([name, value]) => ({ name, value })),
    }

    const res = await fetch(`https://${creds.url}/api/v1/sendTemplateMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const status = res.ok ? "sent" : "failed"

    try {
      await supabase.from("whatsapp_messages").insert({
        studio_id: params.studioId,
        recipient_type: params.recipientType,
        recipient_id: params.recipientId,
        template_id: params.templateName,
        variables: params.variables,
        status,
        project_id: params.projectId ?? null,
        sent_at: res.ok ? new Date().toISOString() : null,
      })
    } catch {
      // never let a logging failure surface
    }
  } catch (err) {
    console.error("sendWhatsAppMessage error:", err)
    try {
      await supabase.from("whatsapp_messages").insert({
        studio_id: params.studioId,
        recipient_type: params.recipientType,
        recipient_id: params.recipientId,
        template_id: params.templateName,
        variables: params.variables,
        status: "failed",
        project_id: params.projectId ?? null,
        sent_at: null,
      })
    } catch {
      // silent
    }
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  studioId: string
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: studio } = await supabase
      .from("studios")
      .select("resend_api_key, sending_email, sending_email_name")
      .eq("id", params.studioId)
      .single()

    const apiKey = studio?.resend_api_key ?? process.env.RESEND_API_KEY
    const fromEmail = studio?.sending_email ?? process.env.RESEND_FROM_EMAIL
    const fromName = studio?.sending_email_name ?? process.env.RESEND_FROM_NAME ?? "ProjectFlow"

    if (!apiKey || !fromEmail) {
      console.warn(`Resend credentials not configured for studio ${params.studioId} — skipping email`)
      return
    }

    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
  } catch (err) {
    console.error("sendEmail error:", err)
  }
}

export async function notifyClientProjectWelcome(clientId: string, projectId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: client } = await supabase
      .from("clients")
      .select("name, whatsapp_number, portal_token, studio_id")
      .eq("id", clientId)
      .single()

    if (!client?.whatsapp_number) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()

    if (!project) return

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${client.portal_token}`

    await sendWhatsAppMessage({
      to: client.whatsapp_number,
      templateName: "project_welcome_client",
      variables: { "1": client.name, "2": project.name, "3": portalUrl },
      studioId: client.studio_id,
      recipientType: "client",
      recipientId: clientId,
      projectId,
    })
  } catch (err) {
    console.error("notifyClientProjectWelcome error:", err)
  }
}

export async function notifyClientProcurementReady(clientId: string, scheduleId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: client } = await supabase
      .from("clients")
      .select("name, whatsapp_number, portal_token, studio_id")
      .eq("id", clientId)
      .single()

    if (!client?.whatsapp_number) return

    const { data: schedule } = await supabase
      .from("procurement_schedules")
      .select("name, project_id")
      .eq("id", scheduleId)
      .single()

    if (!schedule) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", schedule.project_id)
      .single()

    const { data: studioOwner } = await supabase
      .from("users")
      .select("name")
      .eq("studio_id", client.studio_id)
      .eq("role", "owner")
      .limit(1)
      .single()

    const procurementUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${client.portal_token}/${schedule.project_id}/procurement`

    await sendWhatsAppMessage({
      to: client.whatsapp_number,
      templateName: "procurement_approval_request",
      variables: {
        "1": client.name,
        "2": studioOwner?.name ?? "",
        "3": schedule.name,
        "4": procurementUrl,
      },
      studioId: client.studio_id,
      recipientType: "client",
      recipientId: clientId,
      projectId: schedule.project_id,
    })
  } catch (err) {
    console.error("notifyClientProcurementReady error:", err)
  }
}

export async function notifyDesignerProcurementActioned(studioId: string, scheduleId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()

    if (!owner?.whatsapp_number) return

    const { data: schedule } = await supabase
      .from("procurement_schedules")
      .select("name, project_id")
      .eq("id", scheduleId)
      .single()

    if (!schedule) return

    const { data: project } = await supabase
      .from("projects")
      .select("name, client_id")
      .eq("id", schedule.project_id)
      .single()

    let clientName = ""
    if (project?.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", project.client_id)
        .single()
      clientName = client?.name ?? ""
    }

    // Fetch approval counts
    const { data: items } = await supabase
      .from("procurement_items")
      .select("id")
      .eq("schedule_id", scheduleId)

    let approvedCount = 0
    let revisionCount = 0

    if (items && items.length > 0) {
      const itemIds = items.map((i) => i.id)
      const { data: statusRows } = await supabase
        .from("procurement_item_status")
        .select("client_approval_status")
        .in("item_id", itemIds)

      ;(statusRows ?? []).forEach((s) => {
        if (s.client_approval_status === "approved") approvedCount++
        if (s.client_approval_status === "resubmit") revisionCount++
      })
    }

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${schedule.project_id}`

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "procurement_item_actioned",
      variables: {
        "1": owner.name,
        "2": clientName,
        "3": schedule.name,
        "4": String(approvedCount),
        "5": String(revisionCount),
        "6": studioUrl,
      },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number, // use owner id if available
      projectId: schedule.project_id,
    })
  } catch (err) {
    console.error("notifyDesignerProcurementActioned error:", err)
  }
}

export async function notifyClientInvoiceSent(invoiceId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, total, due_date, project_id, client_id, studio_id")
      .eq("id", invoiceId)
      .single()

    if (!invoice) return

    const { data: client } = await supabase
      .from("clients")
      .select("name, whatsapp_number, portal_token")
      .eq("id", invoice.client_id)
      .single()

    if (!client?.whatsapp_number) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", invoice.project_id)
      .single()

    const invoicesUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${client.portal_token}/${invoice.project_id}/invoices`

    await sendWhatsAppMessage({
      to: client.whatsapp_number,
      templateName: "invoice_sent",
      variables: {
        "1": client.name,
        "2": invoice.invoice_number,
        "3": String(invoice.total),
        "4": project?.name ?? "",
        "5": invoice.due_date ?? "N/A",
        "6": invoicesUrl,
      },
      studioId: invoice.studio_id,
      recipientType: "client",
      recipientId: invoice.client_id,
      projectId: invoice.project_id,
    })

    // Update the stub row written by sendInvoice() from Sprint 6
    try {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("template_id", "invoice_sent")
        .eq("project_id", invoice.project_id)
        .eq("status", "queued")
    } catch {
      // silent
    }
  } catch (err) {
    console.error("notifyClientInvoiceSent error:", err)
  }
}

export async function notifySiteUpdatePosted(projectId: string, updateId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: update } = await supabase
      .from("site_updates")
      .select("status_note, submitted_at, studio_id")
      .eq("id", updateId)
      .single()

    if (!update) return

    const { data: project } = await supabase
      .from("projects")
      .select("name, client_id")
      .eq("id", projectId)
      .single()

    if (!project) return

    let portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal`
    if (project.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("portal_token")
        .eq("id", project.client_id)
        .single()
      if (client?.portal_token) {
        portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${client.portal_token}/${projectId}/site`
      }
    }

    const { data: owner } = await supabase
      .from("users")
      .select("whatsapp_number")
      .eq("studio_id", update.studio_id)
      .eq("role", "owner")
      .limit(1)
      .single()

    if (!owner?.whatsapp_number) return

    const formattedDate = new Date(update.submitted_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "site_update_posted",
      variables: {
        "1": project.name,
        "2": formattedDate,
        "3": update.status_note ?? "No note",
        "4": portalUrl,
      },
      studioId: update.studio_id,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId,
    })
  } catch (err) {
    console.error("notifySiteUpdatePosted error:", err)
  }
}

export async function upsertNotificationPreference(
  userId: string,
  studioId: string,
  eventType: string,
  channel: 'in_app' | 'email' | 'whatsapp',
  value: boolean
): Promise<void> {
  const { getAuthContext } = await import("./_auth")
  const { supabase } = await getAuthContext()

  const existing: Record<string, boolean> = { in_app: true, email: true, whatsapp: false }
  const update = { ...existing, [channel]: value }

  await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        studio_id: studioId,
        event_type: eventType,
        in_app: update.in_app,
        email: update.email,
        whatsapp: update.whatsapp,
      },
      { onConflict: "user_id,event_type" }
    )
}

export async function getNotificationPreferences(userId: string): Promise<
  Array<{ event_type: string; in_app: boolean; email: boolean; whatsapp: boolean }>
> {
  const { getAuthContext } = await import("./_auth")
  const { supabase } = await getAuthContext()

  const { data } = await supabase
    .from("notification_preferences")
    .select("event_type, in_app, email, whatsapp")
    .eq("user_id", userId)

  return (data ?? []) as Array<{ event_type: string; in_app: boolean; email: boolean; whatsapp: boolean }>
}

export async function notifyRfiReceived(rfiId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: rfi } = await supabase
      .from("rfis")
      .select("title, project_id, studio_id, response_deadline")
      .eq("id", rfiId)
      .single()
    if (!rfi) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", rfi.project_id)
      .single()
    if (!project) return

    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", rfi.studio_id)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const formattedDeadline = new Date(rfi.response_deadline).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${rfi.project_id}`

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "rfi_received",
      variables: {
        "1": owner.name,
        "2": rfi.title,
        "3": project.name,
        "4": formattedDeadline,
        "5": studioUrl,
      },
      studioId: rfi.studio_id,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId: rfi.project_id,
    })
  } catch (err) {
    console.error("notifyRfiReceived error:", err)
  }
}

export async function notifyRfiResponded(rfiId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: rfi } = await supabase
      .from("rfis")
      .select("title, project_id, studio_id, contractor_id")
      .eq("id", rfiId)
      .single()
    if (!rfi || !rfi.contractor_id) return

    const { data: contractor } = await supabase
      .from("contractors")
      .select("contact_name, whatsapp_number")
      .eq("id", rfi.contractor_id)
      .single()
    if (!contractor?.whatsapp_number) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", rfi.project_id)
      .single()

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${rfi.project_id}`

    await sendWhatsAppMessage({
      to: contractor.whatsapp_number,
      templateName: "rfi_response_sent",
      variables: {
        "1": contractor.contact_name,
        "2": rfi.title,
        "3": project?.name ?? "",
        "4": studioUrl,
      },
      studioId: rfi.studio_id,
      recipientType: "contractor",
      recipientId: rfi.contractor_id,
      projectId: rfi.project_id,
    })
  } catch (err) {
    console.error("notifyRfiResponded error:", err)
  }
}

export async function notifyRfiEscalated(rfiId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: rfi } = await supabase
      .from("rfis")
      .select("title, project_id, studio_id, response_deadline")
      .eq("id", rfiId)
      .single()
    if (!rfi) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", rfi.project_id)
      .single()

    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", rfi.studio_id)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const formattedDeadline = new Date(rfi.response_deadline).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${rfi.project_id}`

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "rfi_escalation",
      variables: {
        "1": owner.name,
        "2": rfi.title,
        "3": project?.name ?? "",
        "4": formattedDeadline,
        "5": studioUrl,
      },
      studioId: rfi.studio_id,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId: rfi.project_id,
    })
  } catch (err) {
    console.error("notifyRfiEscalated error:", err)
  }
}

export async function notifyMeetingNotesShared(meetingId: string, recipientPhones: string[]): Promise<void> {
  // stub — real implementation in Sprint 9
  console.log('WHATSAPP STUB: meeting notes shared', meetingId, recipientPhones)
}

export async function notifyResourceConflict(
  studioId: string,
  conflict: {
    user_id: string
    user_name: string
    conflict_date: string
    pf_event_title: string
    pf_event_type: 'meeting' | 'site_visit' | 'task_due_date'
    busy_block_start: string
    busy_block_end: string
  }
): Promise<void> {
  // Stub — future: send WhatsApp to studio owner
  console.log(
    `notifyResourceConflict: studio=${studioId} user=${conflict.user_name} date=${conflict.conflict_date} event="${conflict.pf_event_title}"`
  )
}

export async function notifyOrderDelayed(
  studioId: string,
  projectId: string,
  itemName: string,
  expectedDate: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${projectId}`
    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "order_delayed",
      variables: { "1": owner.name, "2": itemName, "3": expectedDate, "4": studioUrl },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId,
    })
  } catch (err) {
    console.error("notifyOrderDelayed error:", err)
  }
}

export async function notifyVendorPOSent(
  studioId: string,
  vendorId: string,
  poNumber: string,
  projectName: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: vendor } = await (supabase.from as any)("vendors")
      .select("name, whatsapp_number")
      .eq("id", vendorId)
      .single()
    if (!vendor?.whatsapp_number) return

    const poUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/po/${vendorId}`
    await sendWhatsAppMessage({
      to: vendor.whatsapp_number,
      templateName: "po_sent_to_vendor",
      variables: { "1": vendor.name, "2": poNumber, "3": projectName, "4": poUrl },
      studioId,
      recipientType: "vendor",
      recipientId: vendorId,
    })
  } catch (err) {
    console.error("notifyVendorPOSent error:", err)
  }
}

export async function notifyVendorQuoteRequest(
  studioId: string,
  vendorId: string,
  itemName: string,
  deadline: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: vendor } = await (supabase.from as any)("vendors")
      .select("name, whatsapp_number")
      .eq("id", vendorId)
      .single()
    if (!vendor?.whatsapp_number) return

    await sendWhatsAppMessage({
      to: vendor.whatsapp_number,
      templateName: "quote_request_sent",
      variables: { "1": vendor.name, "2": itemName, "3": deadline },
      studioId,
      recipientType: "vendor",
      recipientId: vendorId,
    })
  } catch (err) {
    console.error("notifyVendorQuoteRequest error:", err)
  }
}

export async function notifyVendorQuoteNotSelected(
  studioId: string,
  vendorId: string,
  itemName: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: vendor } = await (supabase.from as any)("vendors")
      .select("name, whatsapp_number")
      .eq("id", vendorId)
      .single()
    if (!vendor?.whatsapp_number) return

    await sendWhatsAppMessage({
      to: vendor.whatsapp_number,
      templateName: "quote_not_selected",
      variables: { "1": vendor.name, "2": itemName },
      studioId,
      recipientType: "vendor",
      recipientId: vendorId,
    })
  } catch (err) {
    console.error("notifyVendorQuoteNotSelected error:", err)
  }
}

export async function notifyQuoteResponseReceived(
  studioId: string,
  projectId: string,
  itemName: string,
  vendorName: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${projectId}`
    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "quote_response_received",
      variables: { "1": owner.name, "2": itemName, "3": vendorName, "4": studioUrl },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId,
    })
  } catch (err) {
    console.error("notifyQuoteResponseReceived error:", err)
  }
}

export async function notifyPOApprovalRequired(
  studioId: string,
  poNumber: string,
  grandTotal: number
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const formatted = grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/vendors`
    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "po_approval_required",
      variables: { "1": owner.name, "2": poNumber, "3": formatted, "4": studioUrl },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
    })
  } catch (err) {
    console.error("notifyPOApprovalRequired error:", err)
  }
}

export async function notifyPOConfirmedByVendor(
  studioId: string,
  poNumber: string,
  vendorName: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/vendors`
    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "po_confirmed_by_vendor",
      variables: { "1": owner.name, "2": poNumber, "3": vendorName, "4": studioUrl },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
    })
  } catch (err) {
    console.error("notifyPOConfirmedByVendor error:", err)
  }
}

export async function notifyClientMoodboardShared(
  studioId: string,
  projectId: string,
  moodboardTitle: string,
  shareUrl: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: project } = await supabase
      .from("projects")
      .select("name, client_id")
      .eq("id", projectId)
      .single()
    if (!project?.client_id) return

    const { data: client } = await supabase
      .from("clients")
      .select("name, whatsapp_number")
      .eq("id", project.client_id)
      .single()
    if (!client?.whatsapp_number) return

    await sendWhatsAppMessage({
      to: client.whatsapp_number,
      templateName: "moodboard_shared",
      variables: { "1": client.name, "2": moodboardTitle, "3": shareUrl },
      studioId,
      recipientType: "client",
      recipientId: project.client_id,
      projectId,
    })
  } catch (err) {
    console.error("notifyClientMoodboardShared error:", err)
  }
}

export async function notifyMoodboardApproved(
  studioId: string,
  projectId: string,
  moodboardTitle: string,
  approvedByName: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "moodboard_approved",
      variables: {
        "1": moodboardTitle,
        "2": approvedByName,
        "3": project?.name ?? "",
      },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId,
    })
  } catch (err) {
    console.error("notifyMoodboardApproved error:", err)
  }
}

export async function notifyMoodboardRevisionRequested(
  studioId: string,
  projectId: string,
  moodboardTitle: string,
  feedback: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    const { data: owner } = await supabase
      .from("users")
      .select("name, whatsapp_number")
      .eq("studio_id", studioId)
      .eq("role", "owner")
      .limit(1)
      .single()
    if (!owner?.whatsapp_number) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()

    await sendWhatsAppMessage({
      to: owner.whatsapp_number,
      templateName: "moodboard_revision_requested",
      variables: {
        "1": moodboardTitle,
        "2": feedback,
        "3": project?.name ?? "",
      },
      studioId,
      recipientType: "user",
      recipientId: owner.whatsapp_number,
      projectId,
    })
  } catch (err) {
    console.error("notifyMoodboardRevisionRequested error:", err)
  }
}

// ─── Sprint 20: RFI annotation notification stubs ────────────────────────────

export async function notifyRFICreated(rfiId: string): Promise<void> {
  console.log('NOTIFY: RFI created', rfiId)
}

export async function notifyRFIReceivedFromContractor(rfiId: string): Promise<void> {
  console.log('NOTIFY: RFI received from contractor', rfiId)
}

export async function notifyRFIResponded(rfiId: string): Promise<void> {
  console.log('NOTIFY: RFI responded', rfiId)
}

export async function notifyRFIEscalated(rfiId: string): Promise<void> {
  console.log('NOTIFY: RFI escalated', rfiId)
}

export async function notifyRFIAssigned(rfiId: string, assignedToId: string): Promise<void> {
  console.log('NOTIFY: RFI assigned', rfiId, assignedToId)
}

export async function notifyLeaveRequest(leaveRequestId: string): Promise<void> {
  console.log('NOTIFY: new leave request', leaveRequestId)
}

export async function notifyLeaveDecision(leaveRequestId: string, decision: 'approved' | 'rejected'): Promise<void> {
  console.log('NOTIFY: leave decision', decision, leaveRequestId)
}

// ─── Sprint 16: notifyProjectHealthAlert (stub — wired in Sprint 19) ─────────

export async function notifyProjectHealthAlert(
  projectId: string,
  signals: import('./dashboard').HealthSignals
): Promise<void> {
  console.log('NOTIFY: project health alert', projectId, signals.overall)
}

// ─── Sprint 17: Payment automation stubs ─────────────────────────────────────

export async function sendPaymentReceivedNotification(invoiceId: string, amount: number): Promise<void> {
  console.log('NOTIFY: payment received', invoiceId, amount)
}

export async function notifyStagePaymentConfirmed(stagePaymentId: string): Promise<void> {
  console.log('NOTIFY: stage payment confirmed', stagePaymentId)
}

export async function notifyStagePaymentReleased(paymentId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payment } = await (supabase.from as any)("stage_payments")
      .select("milestone_name, amount, project_id, contractor_id, studio_id")
      .eq("id", paymentId)
      .single()
    if (!payment) return

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", payment.project_id)
      .single()
    if (!project) return

    const { data: contractor } = await supabase
      .from("contractors")
      .select("contact_name, whatsapp_number")
      .eq("id", payment.contractor_id)
      .single()
    if (!contractor?.whatsapp_number) return

    const studioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${payment.project_id}`
    const formatted = `₹${Number(payment.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

    await sendWhatsAppMessage({
      to: contractor.whatsapp_number,
      templateName: "stage_payment_released",
      variables: {
        "1": contractor.contact_name,
        "2": formatted,
        "3": project.name,
        "4": payment.milestone_name,
        "5": studioUrl,
      },
      studioId: payment.studio_id,
      recipientType: "contractor",
      recipientId: payment.contractor_id,
      projectId: payment.project_id,
    })
  } catch (err) {
    console.error("notifyStagePaymentReleased error:", err)
  }
}
