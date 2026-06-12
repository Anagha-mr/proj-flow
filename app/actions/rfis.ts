"use server"

import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Sprint 20: Annotation types ─────────────────────────────────────────────

export interface AnnotationData {
  shapes: Array<{
    type: 'circle' | 'rect' | 'arrow' | 'text' | 'freehand'
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    points?: number[]
    color: string
    strokeWidth: number
    text?: string
    fontSize?: number
  }>
  canvas_width: number
  canvas_height: number
  pdf_page: number
  created_at: string
}

export interface RFIWithAnnotations {
  id: string
  studio_id: string
  project_id: string
  contractor_id: string | null
  ref_number: string
  raised_by_type: 'contractor' | 'designer' | 'client'
  title: string
  description: string | null
  linked_document_id: string | null
  space_tag: string | null
  status: 'open' | 'responded' | 'closed' | 'escalated'
  response_deadline: string | null
  annotation_data: AnnotationData | null
  annotation_preview_url: string | null
  response_text: string | null
  response_annotation_data: AnnotationData | null
  responded_by_id: string | null
  responded_at: string | null
  escalated_at: string | null
  created_at: string
  updated_at: string
  document?: { id: string; name: string; file_url: string }
  contractor?: { id: string; company_name: string; contact_name: string; whatsapp_number: string }
  responder?: { id: string; name: string }
}

export interface RFI {
  id: string
  studio_id: string
  project_id: string
  contractor_id: string | null
  ref_number: string
  raised_by_type: 'contractor' | 'designer'
  raised_by_id: string
  title: string
  description: string
  linked_document_id: string | null
  space_tag: string | null
  status: 'open' | 'under_review' | 'responded' | 'closed'
  response_deadline: string
  response_text: string | null
  responded_by_id: string | null
  responded_at: string | null
  escalated_at: string | null
  created_at: string
  updated_at: string
  contractor?: { company_name: string; contact_name: string }
  linked_document?: { name: string }
  responder?: { name: string }
}

async function generateRfiRefNumber(
  projectId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single()

  const rawName = project?.name ?? "PROJ"
  const projectCode = rawName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X")

  const { count } = await supabase
    .from("rfis")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)

  const seq = String((count ?? 0) + 1).padStart(3, "0")
  return `RFI-${projectCode}-${seq}`
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review", "closed"],
  under_review: ["responded"],
  responded: ["closed"],
  closed: [],
}

export async function getRfis(projectId: string): Promise<RFI[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: rfis, error } = await supabase
    .from("rfis")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  if (!rfis || rfis.length === 0) return []

  const contractorIds = [...new Set(rfis.filter((r) => r.contractor_id).map((r) => r.contractor_id as string))]
  const documentIds = [...new Set(rfis.filter((r) => r.linked_document_id).map((r) => r.linked_document_id as string))]
  const responderIds = [...new Set(rfis.filter((r) => r.responded_by_id).map((r) => r.responded_by_id as string))]

  const [contractorData, documentData, responderData] = await Promise.all([
    contractorIds.length > 0
      ? supabase.from("contractors").select("id, company_name, contact_name").in("id", contractorIds)
      : { data: [] },
    documentIds.length > 0
      ? supabase.from("documents").select("id, name").in("id", documentIds)
      : { data: [] },
    responderIds.length > 0
      ? supabase.from("users").select("id, name").in("id", responderIds)
      : { data: [] },
  ])

  const contractorMap = Object.fromEntries(
    (contractorData.data ?? []).map((c) => [c.id, { company_name: c.company_name, contact_name: c.contact_name }])
  )
  const documentMap = Object.fromEntries(
    (documentData.data ?? []).map((d) => [d.id, { name: d.name }])
  )
  const responderMap = Object.fromEntries(
    (responderData.data ?? []).map((u) => [u.id, { name: u.name }])
  )

  return rfis.map((r) => ({
    ...(r as unknown as RFI),
    contractor: r.contractor_id ? contractorMap[r.contractor_id] : undefined,
    linked_document: r.linked_document_id ? documentMap[r.linked_document_id] : undefined,
    responder: r.responded_by_id ? responderMap[r.responded_by_id] : undefined,
  }))
}

export async function createRfi(input: {
  projectId: string
  title: string
  description: string
  contractorId?: string
  linkedDocumentId?: string
  spaceTag?: string
  raisedByType?: 'contractor' | 'designer'
  responseDeadlineHours?: number
}): Promise<RFI> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const refNumber = await generateRfiRefNumber(input.projectId, supabase)
  const deadlineHours = input.responseDeadlineHours ?? 48
  const responseDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("rfis")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      contractor_id: input.contractorId ?? null,
      ref_number: refNumber,
      raised_by_type: input.raisedByType ?? 'designer',
      raised_by_id: userId,
      title: input.title,
      description: input.description,
      linked_document_id: input.linkedDocumentId ?? null,
      space_tag: input.spaceTag ?? null,
      status: 'open',
      response_deadline: responseDeadline,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  try {
    const { notifyRfiReceived } = await import("./notifications")
    notifyRfiReceived(data.id).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as unknown as RFI
}

export async function respondToRfi(rfiId: string, responseText: string): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")
  if (rfi.status === 'responded' || rfi.status === 'closed') {
    throw new Error("RFI is already responded or closed")
  }

  await supabase
    .from("rfis")
    .update({
      response_text: responseText,
      responded_by_id: userId,
      responded_at: new Date().toISOString(),
      status: 'responded',
    })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  try {
    const { notifyRfiResponded } = await import("./notifications")
    notifyRfiResponded(rfiId).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function updateRfiStatus(rfiId: string, status: RFI['status']): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")

  const allowed = VALID_TRANSITIONS[rfi.status] ?? []
  if (!allowed.includes(status)) throw new Error("Invalid status transition")

  await supabase
    .from("rfis")
    .update({ status })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function deleteRfi(rfiId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")
  if (rfi.status !== 'open') throw new Error("Only open RFIs can be deleted")

  await supabase.from("rfis").delete().eq("id", rfiId).eq("studio_id", studioId)
  revalidatePath(`/dashboard/projects/${rfi.project_id}`)
}

export async function checkAndEscalateRfis(projectId: string): Promise<number> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfis } = await supabase
    .from("rfis")
    .select("id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .in("status", ["open", "under_review"])
    .lt("response_deadline", new Date().toISOString())
    .is("escalated_at", null)

  if (!rfis || rfis.length === 0) return 0

  const now = new Date().toISOString()
  const ids = rfis.map((r) => r.id)

  await supabase
    .from("rfis")
    .update({ escalated_at: now })
    .in("id", ids)
    .eq("studio_id", studioId)

  for (const rfi of rfis) {
    try {
      const { notifyRfiEscalated } = await import("./notifications")
      notifyRfiEscalated(rfi.id).catch(() => {})
    } catch {
      // fire-and-forget
    }
  }

  return rfis.length
}

// ─── Sprint 20: Annotation functions ─────────────────────────────────────────

export async function getRFIWithAnnotations(rfiId: string): Promise<RFIWithAnnotations> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi, error } = await supabase
    .from("rfis")
    .select("*")
    .eq("id", rfiId)
    .eq("studio_id", studioId)
    .single()

  if (error || !rfi) throw new Error("RFI not found")

  const [docResult, contResult, respResult] = await Promise.all([
    rfi.linked_document_id
      ? supabase.from("documents").select("id, name, file_url").eq("id", rfi.linked_document_id).single()
      : Promise.resolve({ data: null }),
    rfi.contractor_id
      ? supabase.from("contractors").select("id, company_name, contact_name, whatsapp_number").eq("id", rfi.contractor_id).single()
      : Promise.resolve({ data: null }),
    rfi.responded_by_id
      ? supabase.from("users").select("id, name").eq("id", rfi.responded_by_id).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...(rfi as unknown as RFIWithAnnotations),
    document: docResult.data ?? undefined,
    contractor: contResult.data
      ? (contResult.data as unknown as RFIWithAnnotations['contractor'])
      : undefined,
    responder: respResult.data ?? undefined,
  }
}

export async function createAnnotatedRFI(input: {
  projectId: string
  documentId: string
  title: string
  description: string
  annotationData: AnnotationData
  spaceTag?: string
  contractorId?: string
  responseDeadlineHours?: number
}): Promise<RFIWithAnnotations> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const refNumber = await generateRfiRefNumber(input.projectId, supabase)
  const deadlineHours = input.responseDeadlineHours ?? 48
  const responseDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("rfis")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      contractor_id: input.contractorId ?? null,
      ref_number: refNumber,
      raised_by_type: 'designer',
      raised_by_id: userId,
      title: input.title,
      description: input.description,
      linked_document_id: input.documentId,
      space_tag: input.spaceTag ?? null,
      status: 'open',
      response_deadline: responseDeadline,
      annotation_data: input.annotationData,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  try {
    const { notifyRFICreated } = await import("./notifications")
    notifyRFICreated(data.id).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${input.projectId}/rfi`)
  return data as unknown as RFIWithAnnotations
}

// Public — no auth context. Called from contractor no-login view via API route.
export async function createAnnotatedRFIFromContractor(input: {
  contractorToken: string
  projectId: string
  documentId: string
  title: string
  description: string
  annotationData: AnnotationData
  spaceTag?: string
}): Promise<{ rfiId: string; refNumber: string }> {
  const supabase = createServiceClient()

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, studio_id, contractor_token_expires_at")
    .eq("contractor_token", input.contractorToken)
    .single()

  if (!contractor) throw new Error("Invalid contractor token")
  if (
    contractor.contractor_token_expires_at &&
    new Date(contractor.contractor_token_expires_at) < new Date()
  ) {
    throw new Error("Contractor token has expired")
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", contractor.studio_id)
    .in("status", ["active", "on_hold"])
    .single()
  if (!project) throw new Error("Project not found or not accessible")

  const { data: document } = await supabase
    .from("documents")
    .select("id")
    .eq("id", input.documentId)
    .eq("project_id", input.projectId)
    .single()
  if (!document) throw new Error("Document not found")

  const refNumber = await generateRfiRefNumber(input.projectId, supabase)
  const responseDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("rfis")
    .insert({
      studio_id: contractor.studio_id,
      project_id: input.projectId,
      contractor_id: contractor.id,
      ref_number: refNumber,
      raised_by_type: 'contractor',
      raised_by_id: contractor.id,
      title: input.title,
      description: input.description,
      linked_document_id: input.documentId,
      space_tag: input.spaceTag ?? null,
      status: 'open',
      response_deadline: responseDeadline,
      annotation_data: input.annotationData,
    })
    .select("id, ref_number")
    .single()

  if (error) throw new Error(error.message)

  try {
    const { notifyRFIReceivedFromContractor } = await import("./notifications")
    notifyRFIReceivedFromContractor(data.id).catch(() => {})
  } catch {
    // fire-and-forget
  }

  return { rfiId: data.id, refNumber: data.ref_number }
}

export async function respondToRFI(
  rfiId: string,
  input: { responseText: string; responseAnnotationData?: AnnotationData }
): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id, status")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")
  if (rfi.status !== 'open' && rfi.status !== 'escalated') {
    throw new Error("RFI cannot be responded to in its current state")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)("rfis")
    .update({
      response_text: input.responseText,
      response_annotation_data: input.responseAnnotationData ?? null,
      responded_by_id: userId,
      responded_at: new Date().toISOString(),
      status: 'responded',
    })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  try {
    const { notifyRFIResponded } = await import("./notifications")
    notifyRFIResponded(rfiId).catch(() => {})
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/projects/${rfi.project_id}/rfi`)
}

export async function closeRFI(rfiId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: rfi } = await supabase
    .from("rfis")
    .select("project_id, studio_id")
    .eq("id", rfiId)
    .single()
  if (!rfi || rfi.studio_id !== studioId) throw new Error("RFI not found")

  await supabase
    .from("rfis")
    .update({ status: 'closed' })
    .eq("id", rfiId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${rfi.project_id}/rfi`)
}

// Public — no auth context. For contractor mobile view.
export async function getContractorRFIs(
  contractorToken: string,
  projectId: string
): Promise<RFIWithAnnotations[]> {
  const supabase = createServiceClient()

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, contractor_token_expires_at")
    .eq("contractor_token", contractorToken)
    .single()

  if (!contractor) return []
  if (
    contractor.contractor_token_expires_at &&
    new Date(contractor.contractor_token_expires_at) < new Date()
  ) {
    return []
  }

  const { data: rfis } = await supabase
    .from("rfis")
    .select("*")
    .eq("project_id", projectId)
    .eq("contractor_id", contractor.id)
    .order("created_at", { ascending: false })

  if (!rfis || rfis.length === 0) return []

  const docIds = [...new Set(rfis.filter((r) => r.linked_document_id).map((r) => r.linked_document_id as string))]
  const docMap: Record<string, { id: string; name: string; file_url: string }> = {}

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, file_url")
      .in("id", docIds)
    ;(docs ?? []).forEach((d) => {
      docMap[d.id] = d as { id: string; name: string; file_url: string }
    })
  }

  return rfis.map((r) => ({
    ...(r as unknown as RFIWithAnnotations),
    document: r.linked_document_id ? docMap[r.linked_document_id] : undefined,
  }))
}

export async function getProjectDocumentsForRFI(
  projectId: string
): Promise<Array<{ id: string; name: string; file_url: string; version: number }>> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) return []

  const { data: docs } = await supabase
    .from("documents")
    .select("id, name, file_url, version_number")
    .eq("project_id", projectId)
    .eq("version_status", "latest_issued")
    .order("name", { ascending: true })

  return (docs ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    file_url: d.file_url,
    version: d.version_number ?? 1,
  }))
}
