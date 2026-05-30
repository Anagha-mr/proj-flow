"use server"

import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LineItem {
  description: string
  quantity: number
  unit_rate: number
  gst_rate: number
  amount: number
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  bank_reference: string | null
  razorpay_payment_id: string | null
  payment_source: "manual" | "razorpay_webhook" | "razorpay_manual"
  notes: string | null
}

export interface InvoiceWithPayments {
  id: string
  studio_id: string
  project_id: string
  client_id: string
  invoice_number: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  line_items: any[]
  subtotal: number
  gst_amount: number
  total: number
  status: "draft" | "sent" | "partial" | "partially_paid" | "paid" | "overdue" | "cancelled"
  issue_date: string
  due_date: string | null
  sent_at: string | null
  razorpay_payment_link_id: string | null
  razorpay_payment_link_url: string | null
  razorpay_payment_link_status: string | null
  reminders_paused: boolean
  reminder_sent_at: string[] | null
  payments: InvoicePayment[]
  amount_paid: number
  amount_outstanding: number
  client?: {
    id: string
    name: string
    phone_primary: string | null
    whatsapp_number: string | null
    email: string | null
  }
  project?: { id: string; name: string }
}

export interface RazorpayPaymentLink {
  id: string
  short_url: string
  amount: number
  status: string
  expire_by: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })
}

// ─── generateRazorpayPaymentLink ──────────────────────────────────────────────

export async function generateRazorpayPaymentLink(
  invoiceId: string
): Promise<RazorpayPaymentLink> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (supabase.from as any)("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single() as { data: Record<string, unknown> | null }
  if (!invoice) throw new Error("Invoice not found")

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    throw new Error("Invoice cannot generate payment link")
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, phone_primary, whatsapp_number, email")
    .eq("id", invoice.client_id as string)
    .single()
  if (!client) throw new Error("Client not found")

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", invoice.project_id as string)
    .single()
  if (!project) throw new Error("Project not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studio } = await (supabase.from as any)("studios")
    .select("razorpay_key_id, razorpay_key_secret, razorpay_pass_fee_to_client")
    .eq("id", studioId)
    .single() as {
    data: {
      razorpay_key_id: string | null
      razorpay_key_secret: string | null
      razorpay_pass_fee_to_client: boolean
    } | null
  }

  if (!studio?.razorpay_key_id || !studio?.razorpay_key_secret) {
    throw new Error("Razorpay credentials not configured. Go to Settings → Integrations.")
  }

  let totalAmount = invoice.total as number
  if (studio.razorpay_pass_fee_to_client) {
    totalAmount = Math.round(totalAmount * 1.02 * 100) / 100
  }
  const amountInPaise = Math.round(totalAmount * 100)

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date as string)
    : new Date()
  const expireByTimestamp = Math.floor(
    (dueDate.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000
  )

  const Razorpay = (await import("razorpay")).default
  const razorpay = new Razorpay({
    key_id: studio.razorpay_key_id,
    key_secret: studio.razorpay_key_secret,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentLink = await (razorpay as any).paymentLink.create({
    amount: amountInPaise,
    currency: "INR",
    description: `Invoice ${invoice.invoice_number as string} — ${project.name}`,
    customer: {
      name: client.name,
      contact: client.whatsapp_number || client.phone_primary || undefined,
      email: client.email || undefined,
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    expire_by: expireByTimestamp,
    reference_id: invoice.id as string,
    notes: {
      studio_id: studioId,
      invoice_id: invoice.id as string,
      project_id: invoice.project_id as string,
    },
  }) as RazorpayPaymentLink

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoices")
    .update({
      razorpay_payment_link_id: paymentLink.id,
      razorpay_payment_link_url: paymentLink.short_url,
      razorpay_payment_link_status: "created",
    })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  return paymentLink
}

// ─── sendInvoiceToClient ──────────────────────────────────────────────────────

export async function sendInvoiceToClient(invoiceId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (supabase.from as any)("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single() as { data: Record<string, unknown> | null }
  if (!invoice) throw new Error("Invoice not found")

  if (invoice.status !== "draft" && invoice.status !== "sent") {
    throw new Error("Only draft or sent invoices can be sent")
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone_primary, whatsapp_number, email")
    .eq("id", invoice.client_id as string)
    .single()
  if (!client) throw new Error("Client not found")

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", invoice.project_id as string)
    .single()
  if (!project) throw new Error("Project not found")

  let paymentLinkUrl: string | null = invoice.razorpay_payment_link_url as string | null
  const linkStatus = invoice.razorpay_payment_link_status as string | null

  if (!paymentLinkUrl || linkStatus === "expired" || linkStatus === "cancelled") {
    try {
      const link = await generateRazorpayPaymentLink(invoiceId)
      paymentLinkUrl = link.short_url
    } catch {
      paymentLinkUrl = null
    }
  }

  // Re-fetch payment link URL after potential generation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fresh } = await (supabase.from as any)("invoices")
    .select("razorpay_payment_link_url")
    .eq("id", invoiceId)
    .single() as { data: { razorpay_payment_link_url: string | null } | null }
  paymentLinkUrl = fresh?.razorpay_payment_link_url ?? paymentLinkUrl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  if (client.whatsapp_number && paymentLinkUrl) {
    const { sendWhatsAppMessage } = await import("./notifications")
    await sendWhatsAppMessage({
      to: client.whatsapp_number,
      templateName: "invoice_sent",
      variables: {
        "1": client.name,
        "2": invoice.invoice_number as string,
        "3": formatINR(invoice.total as number),
        "4": invoice.due_date
          ? new Date(invoice.due_date as string).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "N/A",
        "5": paymentLinkUrl,
      },
      studioId,
      recipientType: "client",
      recipientId: client.id,
      projectId: invoice.project_id as string,
    })
  }

  const serviceClient = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from as any)("payment_reminders")
    .insert({
      studio_id: studioId,
      invoice_id: invoiceId,
      reminder_type: "invoice_sent",
    })
    .then(() => {})
    .catch(() => {})

  revalidatePath(`/dashboard/projects/${invoice.project_id as string}/finance`)
}

// ─── recordManualPayment ──────────────────────────────────────────────────────

export async function recordManualPayment(
  invoiceId: string,
  input: {
    amount: number
    paymentDate: string
    bankReference?: string
    notes?: string
  }
): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total, project_id, status")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")

  if (invoice.status === "draft") {
    throw new Error("Cannot record payment on a draft invoice")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      studio_id: studioId,
      amount: input.amount,
      payment_date: input.paymentDate,
      bank_reference: input.bankReference ?? null,
      notes: input.notes ?? null,
      recorded_by_id: userId,
      payment_source: "manual",
    })

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("studio_id", studioId)

  const amountPaid = (payments ?? []).reduce(
    (sum, p) => sum + p.amount,
    0
  )
  const total = invoice.total as number
  const newStatus =
    amountPaid >= total ? "paid" : amountPaid > 0 ? "partially_paid" : "sent"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoices")
    .update({ status: newStatus })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${invoice.project_id as string}/finance`)
}

// ─── pauseInvoiceReminders ────────────────────────────────────────────────────

export async function pauseInvoiceReminders(invoiceId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("project_id")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoices")
    .update({ reminders_paused: true })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${invoice.project_id as string}/finance`)
}

// ─── resumeInvoiceReminders ───────────────────────────────────────────────────

export async function resumeInvoiceReminders(invoiceId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("project_id")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) throw new Error("Invoice not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("invoices")
    .update({ reminders_paused: false })
    .eq("id", invoiceId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${invoice.project_id as string}/finance`)
}

// ─── getInvoiceWithPayments ───────────────────────────────────────────────────

export async function getInvoiceWithPayments(
  invoiceId: string
): Promise<InvoiceWithPayments> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (supabase.from as any)("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single() as { data: Record<string, unknown> | null }
  if (!invoice) throw new Error("Invoice not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase.from as any)("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("studio_id", studioId)
    .order("payment_date", { ascending: false }) as { data: Record<string, unknown>[] | null }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone_primary, whatsapp_number, email")
    .eq("id", invoice.client_id as string)
    .single()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", invoice.project_id as string)
    .single()

  const invoicePayments: InvoicePayment[] = ((payments ?? []) as Record<string, unknown>[]).map(
    (p) => ({
      id: p.id as string,
      invoice_id: p.invoice_id as string,
      amount: p.amount as number,
      payment_date: p.payment_date as string,
      bank_reference: (p.bank_reference as string) ?? null,
      razorpay_payment_id: (p.razorpay_payment_id as string) ?? null,
      payment_source: ((p.payment_source as string) ?? "manual") as
        | "manual"
        | "razorpay_webhook"
        | "razorpay_manual",
      notes: (p.notes as string) ?? null,
    })
  )

  const amountPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0)

  return {
    ...(invoice as unknown as InvoiceWithPayments),
    payments: invoicePayments,
    amount_paid: amountPaid,
    amount_outstanding: (invoice.total as number) - amountPaid,
    client: client
      ? {
          id: client.id,
          name: client.name,
          phone_primary: client.phone_primary,
          whatsapp_number: client.whatsapp_number,
          email: client.email,
        }
      : undefined,
    project: project ?? undefined,
  }
}

// ─── getProjectInvoices ───────────────────────────────────────────────────────

export async function getProjectInvoices(
  projectId: string
): Promise<InvoiceWithPayments[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoices, error } = await (supabase.from as any)("invoices")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("issue_date", { ascending: false }) as {
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }

  if (error) throw new Error(error.message)
  if (!invoices || invoices.length === 0) return []

  const invoiceIds = invoices.map((i) => i.id as string)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase.from as any)("invoice_payments")
    .select("*")
    .in("invoice_id", invoiceIds)
    .eq("studio_id", studioId) as { data: Record<string, unknown>[] | null }

  const clientIds = [...new Set(invoices.map((i) => i.client_id as string))]
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, phone_primary, whatsapp_number, email")
    .in("id", clientIds)

  const clientMap = Object.fromEntries(
    ((clients ?? []) as typeof clients & Record<string, unknown>[]).map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        phone_primary: c.phone_primary,
        whatsapp_number: c.whatsapp_number,
        email: c.email,
      },
    ])
  )

  const paymentsMap: Record<string, InvoicePayment[]> = {}
  for (const p of payments ?? []) {
    const iid = p.invoice_id as string
    if (!paymentsMap[iid]) paymentsMap[iid] = []
    paymentsMap[iid].push({
      id: p.id as string,
      invoice_id: iid,
      amount: p.amount as number,
      payment_date: p.payment_date as string,
      bank_reference: (p.bank_reference as string) ?? null,
      razorpay_payment_id: (p.razorpay_payment_id as string) ?? null,
      payment_source: ((p.payment_source as string) ?? "manual") as
        | "manual"
        | "razorpay_webhook"
        | "razorpay_manual",
      notes: (p.notes as string) ?? null,
    })
  }

  const result = invoices.map((inv) => {
    const invPayments = paymentsMap[inv.id as string] ?? []
    const amountPaid = invPayments.reduce((sum, p) => sum + p.amount, 0)
    return {
      ...(inv as unknown as InvoiceWithPayments),
      payments: invPayments,
      amount_paid: amountPaid,
      amount_outstanding: (inv.total as number) - amountPaid,
      client: clientMap[inv.client_id as string],
    }
  })

  return result.sort((a, b) => {
    if (a.status === "draft" && b.status !== "draft") return -1
    if (a.status !== "draft" && b.status === "draft") return 1
    return new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
  })
}

// ─── sendPaymentReminder ──────────────────────────────────────────────────────

export async function sendPaymentReminder(
  invoiceId: string,
  reminderType: string
): Promise<void> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (supabase.from as any)("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single() as { data: Record<string, unknown> | null }
  if (!invoice) return

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone_primary, whatsapp_number, email")
    .eq("id", invoice.client_id as string)
    .single()
  if (!client?.whatsapp_number) return

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", invoice.project_id as string)
    .single()

  let paymentLinkUrl = invoice.razorpay_payment_link_url as string | null
  const linkStatus = invoice.razorpay_payment_link_status as string | null

  if (!paymentLinkUrl || linkStatus === "expired" || linkStatus === "cancelled") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studio } = await (supabase.from as any)("studios")
      .select("razorpay_key_id, razorpay_key_secret, razorpay_pass_fee_to_client")
      .eq("id", invoice.studio_id as string)
      .single() as {
      data: {
        razorpay_key_id: string | null
        razorpay_key_secret: string | null
        razorpay_pass_fee_to_client: boolean
      } | null
    }

    if (studio?.razorpay_key_id && studio?.razorpay_key_secret) {
      try {
        let totalAmount = invoice.total as number
        if (studio.razorpay_pass_fee_to_client) {
          totalAmount = Math.round(totalAmount * 1.02 * 100) / 100
        }
        const amountInPaise = Math.round(totalAmount * 100)
        const dueDate = invoice.due_date
          ? new Date(invoice.due_date as string)
          : new Date()
        const expireByTimestamp = Math.floor(
          (dueDate.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000
        )

        const Razorpay = (await import("razorpay")).default
        const razorpay = new Razorpay({
          key_id: studio.razorpay_key_id,
          key_secret: studio.razorpay_key_secret,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newLink = await (razorpay as any).paymentLink.create({
          amount: amountInPaise,
          currency: "INR",
          description: `Invoice ${invoice.invoice_number as string} — ${project?.name ?? ""}`,
          customer: {
            name: client.name,
            contact: client.whatsapp_number || client.phone_primary || undefined,
            email: client.email || undefined,
          },
          notify: { sms: false, email: false },
          reminder_enable: false,
          expire_by: expireByTimestamp,
          reference_id: invoiceId,
          notes: {
            studio_id: invoice.studio_id as string,
            invoice_id: invoiceId,
            project_id: invoice.project_id as string,
          },
        }) as RazorpayPaymentLink

        paymentLinkUrl = newLink.short_url

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from as any)("invoices")
          .update({
            razorpay_payment_link_id: newLink.id,
            razorpay_payment_link_url: newLink.short_url,
            razorpay_payment_link_status: "created",
          })
          .eq("id", invoiceId)
      } catch (err) {
        console.error("Failed to regenerate payment link:", err)
      }
    }
  }

  const templateMap: Record<
    string,
    { templateName: string; variables: string[] }
  > = {
    reminder_3_days_before: {
      templateName: "invoice_reminder_due",
      variables: [
        client.name,
        invoice.invoice_number as string,
        formatINR(invoice.total as number),
        "3 days",
        paymentLinkUrl ?? "",
      ],
    },
    reminder_due_today: {
      templateName: "invoice_due_today",
      variables: [
        client.name,
        invoice.invoice_number as string,
        formatINR(invoice.total as number),
        paymentLinkUrl ?? "",
      ],
    },
    reminder_7_days_overdue: {
      templateName: "invoice_overdue",
      variables: [
        client.name,
        invoice.invoice_number as string,
        formatINR(invoice.total as number),
        "7",
        paymentLinkUrl ?? "",
      ],
    },
    reminder_14_days_overdue: {
      templateName: "invoice_overdue",
      variables: [
        client.name,
        invoice.invoice_number as string,
        formatINR(invoice.total as number),
        "14",
        paymentLinkUrl ?? "",
      ],
    },
    reminder_30_days_overdue: {
      templateName: "invoice_overdue",
      variables: [
        client.name,
        invoice.invoice_number as string,
        formatINR(invoice.total as number),
        "30",
        paymentLinkUrl ?? "",
      ],
    },
  }

  const template = templateMap[reminderType]
  if (!template) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studio } = await (supabase.from as any)("studios")
    .select("wati_api_url, wati_api_key")
    .eq("id", invoice.studio_id as string)
    .single() as {
    data: { wati_api_url: string | null; wati_api_key: string | null } | null
  }

  if (studio?.wati_api_url && studio?.wati_api_key) {
    const parameters = template.variables.map((val, idx) => ({
      name: String(idx + 1),
      value: val,
    }))

    try {
      await fetch(`https://${studio.wati_api_url}/api/v1/sendTemplateMessage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${studio.wati_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsappNumber: client.whatsapp_number,
          template_name: template.templateName,
          broadcast_name: template.templateName,
          parameters,
        }),
      })
    } catch (err) {
      console.error("sendPaymentReminder WhatsApp error:", err)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("payment_reminders")
    .insert({
      studio_id: invoice.studio_id as string,
      invoice_id: invoiceId,
      reminder_type: reminderType,
      sent_at: new Date().toISOString(),
    })
    .then(() => {})
    .catch(() => {})
}
