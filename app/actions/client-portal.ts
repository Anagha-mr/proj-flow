"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "./_auth"
import type { SiteUpdate } from "./site"

export interface PortalProjectSummary {
  id: string
  name: string
  status: string
  cover_image_url: string | null
  phases: Array<{ name: string; start_date: string; end_date: string; status: string }>
  task_counts: { total: number; completed: number; in_progress: number; todo: number }
  site_updates_preview: SiteUpdate[]
}

export interface PortalFullProject extends PortalProjectSummary {
  tasks: Array<{ id: string; title: string; status: string; due_date: string | null; phase_tag: string | null }>
  documents: Array<{ id: string; name: string; category: string; file_url: string; version_number: number; version_status: string }>
  procurement_schedules: Array<{ id: string; name: string; is_client_published: boolean; share_token: string | null }>
  invoices: PortalInvoice[]
  site_updates: SiteUpdate[]
}

export interface PortalInvoice {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  total: number
  status: string
  amount_paid: number
  amount_due: number
}

async function validatePortalToken(portalToken: string) {
  const supabase = await createClient()

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, studio_id, portal_token_expires_at, portal_token")
    .eq("portal_token", portalToken)
    .single()

  if (!client) throw new Error("Invalid or expired portal link")

  if (client.portal_token_expires_at && new Date(client.portal_token_expires_at) < new Date()) {
    throw new Error("This portal link has expired")
  }

  return client
}

export async function getPortalClient(portalToken: string): Promise<{
  id: string
  name: string
  studio: { name: string; logo_url: string | null }
}> {
  const supabase = await createClient()
  const client = await validatePortalToken(portalToken)

  const { data: studio } = await supabase
    .from("studios")
    .select("name, logo_url")
    .eq("id", client.studio_id)
    .single()

  return {
    id: client.id,
    name: client.name,
    studio: {
      name: studio?.name ?? "",
      logo_url: (studio as unknown as { logo_url?: string | null })?.logo_url ?? null,
    },
  }
}

export async function getPortalProjects(portalToken: string): Promise<PortalProjectSummary[]> {
  const supabase = await createClient()
  const client = await validatePortalToken(portalToken)

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, cover_image_url, phases")
    .eq("client_id", client.id)
    .eq("studio_id", client.studio_id)

  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p) => p.id)

  // Fetch task counts via separate query, grouped by status
  const { data: tasks } = await supabase
    .from("tasks")
    .select("project_id, status")
    .in("project_id", projectIds)

  const taskCountMap: Record<string, { total: number; completed: number; in_progress: number; todo: number }> = {}
  ;(tasks ?? []).forEach((t) => {
    if (!taskCountMap[t.project_id]) {
      taskCountMap[t.project_id] = { total: 0, completed: 0, in_progress: 0, todo: 0 }
    }
    taskCountMap[t.project_id].total++
    if (t.status === "done") taskCountMap[t.project_id].completed++
    else if (t.status === "in_progress") taskCountMap[t.project_id].in_progress++
    else taskCountMap[t.project_id].todo++
  })

  // Fetch latest 3 client-visible site updates per project
  const { data: allSiteUpdates } = await supabase
    .from("site_updates")
    .select("*")
    .in("project_id", projectIds)
    .eq("is_client_visible", true)
    .order("submitted_at", { ascending: false })

  const siteUpdatesByProject: Record<string, SiteUpdate[]> = {}
  ;(allSiteUpdates ?? []).forEach((u) => {
    if (!siteUpdatesByProject[u.project_id]) siteUpdatesByProject[u.project_id] = []
    if (siteUpdatesByProject[u.project_id].length < 3) {
      siteUpdatesByProject[u.project_id].push(u as unknown as SiteUpdate)
    }
  })

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    cover_image_url: p.cover_image_url,
    phases: Array.isArray(p.phases) ? (p.phases as Array<{ name: string; start_date: string; end_date: string; status: string }>) : [],
    task_counts: taskCountMap[p.id] ?? { total: 0, completed: 0, in_progress: 0, todo: 0 },
    site_updates_preview: siteUpdatesByProject[p.id] ?? [],
  }))
}

export async function getPortalProject(portalToken: string, projectId: string): Promise<PortalFullProject> {
  const supabase = await createClient()
  const client = await validatePortalToken(portalToken)

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, cover_image_url, phases")
    .eq("id", projectId)
    .eq("client_id", client.id)
    .eq("studio_id", client.studio_id)
    .single()

  if (!project) throw new Error("Project not found")

  // Tasks — id, title, status, due_date, phase_tag only
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, phase_tag")
    .eq("project_id", projectId)
    .is("parent_task_id", null)
    .order("due_date", { ascending: true, nullsFirst: false })

  // Task counts
  const taskArr = tasks ?? []
  const task_counts = {
    total: taskArr.length,
    completed: taskArr.filter((t) => t.status === "done").length,
    in_progress: taskArr.filter((t) => t.status === "in_progress").length,
    todo: taskArr.filter((t) => t.status === "todo").length,
  }

  // Documents — only client-visible / public, latest_issued
  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, category, file_url, version_number, version_status")
    .eq("project_id", projectId)
    .eq("studio_id", client.studio_id)
    .in("access_level", ["client", "public"])
    .eq("version_status", "latest_issued")
    .order("uploaded_at", { ascending: false })

  // Procurement schedules — only published
  const { data: procurementSchedules } = await supabase
    .from("procurement_schedules")
    .select("id, name, is_client_published, share_token")
    .eq("project_id", projectId)
    .eq("studio_id", client.studio_id)
    .eq("is_client_published", true)
    .eq("is_archived", false)

  // Invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, due_date, total, status")
    .eq("project_id", projectId)
    .eq("client_id", client.id)
    .neq("status", "draft")

  const invoiceIds = (invoices ?? []).map((i) => i.id)
  const { data: payments } = invoiceIds.length > 0
    ? await supabase
        .from("invoice_payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
    : { data: [] }

  const paymentMap: Record<string, number> = {}
  ;(payments ?? []).forEach((p) => {
    paymentMap[p.invoice_id] = (paymentMap[p.invoice_id] ?? 0) + p.amount
  })

  const portalInvoices: PortalInvoice[] = (invoices ?? []).map((inv) => {
    const paid = paymentMap[inv.id] ?? 0
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total: inv.total,
      status: inv.status,
      amount_paid: paid,
      amount_due: inv.total - paid,
    }
  })

  // Site updates — client visible only
  const { data: siteUpdates } = await supabase
    .from("site_updates")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", client.studio_id)
    .eq("is_client_visible", true)
    .order("submitted_at", { ascending: false })

  const phases = Array.isArray(project.phases)
    ? (project.phases as Array<{ name: string; start_date: string; end_date: string; status: string }>)
    : []

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    cover_image_url: project.cover_image_url,
    phases,
    task_counts,
    site_updates_preview: (siteUpdates ?? []).slice(0, 3) as unknown as SiteUpdate[],
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      phase_tag: t.phase_tag,
    })),
    documents: (documents ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      file_url: d.file_url,
      version_number: d.version_number,
      version_status: d.version_status,
    })),
    procurement_schedules: (procurementSchedules ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      is_client_published: s.is_client_published,
      share_token: s.share_token as string | null,
    })),
    invoices: portalInvoices,
    site_updates: (siteUpdates ?? []) as unknown as SiteUpdate[],
  }
}

export async function getPortalInvoices(portalToken: string): Promise<PortalInvoice[]> {
  const supabase = await createClient()
  const client = await validatePortalToken(portalToken)

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, due_date, total, status, project_id")
    .eq("client_id", client.id)
    .neq("status", "draft")

  if (!invoices || invoices.length === 0) return []

  const invoiceIds = invoices.map((i) => i.id)
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("invoice_id, amount")
    .in("invoice_id", invoiceIds)

  const paymentMap: Record<string, number> = {}
  ;(payments ?? []).forEach((p) => {
    paymentMap[p.invoice_id] = (paymentMap[p.invoice_id] ?? 0) + p.amount
  })

  const result: PortalInvoice[] = invoices.map((inv) => {
    const paid = paymentMap[inv.id] ?? 0
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total: inv.total,
      status: inv.status,
      amount_paid: paid,
      amount_due: inv.total - paid,
    }
  })

  // Sort: overdue first, then by due_date ASC
  return result.sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1
    if (a.status !== "overdue" && b.status === "overdue") return 1
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}

export async function getPortalMoodboards(
  portalToken: string,
  projectId: string
): Promise<Array<{
  id: string
  title: string
  description: string | null
  canva_embed_url: string | null
  status: string
  client_feedback: string | null
  client_approved_at: string | null
  share_token: string
}>> {
  const supabase = await createClient()
  const client = await validatePortalToken(portalToken)

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("client_id", client.id)
    .eq("studio_id", client.studio_id)
    .single()

  if (!project) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)("moodboards")
    .select("id, title, description, canva_embed_url, status, client_feedback, client_approved_at, share_token")
    .eq("project_id", projectId)
    .eq("is_client_visible", true)
    .order("display_order", { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    canva_embed_url: m.canva_embed_url,
    status: m.status,
    client_feedback: m.client_feedback,
    client_approved_at: m.client_approved_at,
    share_token: m.share_token,
  }))
}

export async function logPortalView(portalToken: string, projectId: string): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("portal_token", portalToken)
      .single()

    if (!client || !projectId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("document_access_logs") as any).insert({
      project_id: projectId,
      accessed_by_type: "client",
      accessed_by_id: client.id,
      accessed_at: new Date().toISOString(),
    })
  } catch {
    // fire-and-forget — always silent
  }
}

// ─── getClientPortalLinkForSend ───────────────────────────────
// Studio-side, read-only: fetches the client's current portal token + WhatsApp
// number so the UI can build a wa.me link. Never creates or changes tokens.
export async function getClientPortalLinkForSend(clientId: string): Promise<
  | { ok: true; name: string; whatsappNumber: string; portalToken: string }
  | { ok: false; reason: "no_whatsapp" | "no_token" | "expired_token" | "not_found" }
> {
  const { supabase, studioId } = await getAuthContext()

  const { data: client } = await supabase
    .from("clients")
    .select("name, whatsapp_number, portal_token, portal_token_expires_at")
    .eq("id", clientId)
    .eq("studio_id", studioId)
    .single()

  if (!client) return { ok: false, reason: "not_found" }
  if (!client.whatsapp_number?.trim()) return { ok: false, reason: "no_whatsapp" }
  if (!client.portal_token) return { ok: false, reason: "no_token" }
  if (client.portal_token_expires_at && new Date(client.portal_token_expires_at) < new Date()) {
    return { ok: false, reason: "expired_token" }
  }

  return {
    ok: true,
    name: client.name,
    whatsappNumber: client.whatsapp_number.trim(),
    portalToken: client.portal_token,
  }
}
