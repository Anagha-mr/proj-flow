"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentCategory =
  | 'Drawings'
  | 'Specifications'
  | 'Site Photos'
  | 'Contracts'
  | 'Reports'
  | 'Client Shared'
  | 'Contractor Shared'

export type VersionStatus = 'latest_issued' | 'superseded' | 'archived'
export type AccessLevel = 'internal' | 'client_visible' | 'contractor_visible' | 'public'

export interface DocumentRecord {
  id: string
  studio_id: string
  project_id: string
  name: string
  category: DocumentCategory
  file_url: string
  file_type: string
  file_size_bytes: number | null
  version_number: number
  version_status: VersionStatus
  access_level: AccessLevel
  uploaded_by_id: string
  previous_version_id: string | null
  share_token: string
  share_token_expires_at: string | null
  share_enabled: boolean
  description: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  uploader?: { name: string; role: string }
}

export interface DocumentAccessLog {
  id: string
  document_id: string
  studio_id: string
  accessed_by_type: 'studio_member' | 'client' | 'contractor' | 'public'
  accessed_by_id: string | null
  accessed_at: string
  ip_address: string | null
  user_agent: string | null
  accessor_name?: string | null
}

const ALL_CATEGORIES: DocumentCategory[] = [
  'Drawings',
  'Specifications',
  'Site Photos',
  'Contracts',
  'Reports',
  'Client Shared',
  'Contractor Shared',
]

const STATUS_ORDER: Record<VersionStatus, number> = {
  latest_issued: 0,
  superseded: 1,
  archived: 2,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichWithUploaders(supabase: any, docs: DocumentRecord[]): Promise<DocumentRecord[]> {
  if (!docs.length) return docs
  const uploaderIds = [...new Set(docs.map((d) => d.uploaded_by_id))]
  const { data: uploaders } = await supabase
    .from("users")
    .select("id, name, role")
    .in("id", uploaderIds)
  const uploaderMap: Record<string, { name: string; role: string }> = {}
  for (const u of uploaders ?? []) uploaderMap[u.id] = { name: u.name, role: u.role }
  return docs.map((d) => ({ ...d, uploader: uploaderMap[d.uploaded_by_id] ?? undefined }))
}

function sortDocuments(docs: DocumentRecord[]): DocumentRecord[] {
  return [...docs].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.version_status] - STATUS_ORDER[b.version_status]
    if (statusDiff !== 0) return statusDiff
    return b.version_number - a.version_number
  })
}

// ─── getDocuments ─────────────────────────────────────────────────────────────

export async function getDocuments(projectId: string): Promise<DocumentRecord[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (error) throw error

  const enriched = await enrichWithUploaders(supabase, (data ?? []) as DocumentRecord[])
  return sortDocuments(enriched)
}

// ─── getDocumentsByCategory ───────────────────────────────────────────────────

export async function getDocumentsByCategory(
  projectId: string
): Promise<Record<DocumentCategory, DocumentRecord[]>> {
  const docs = await getDocuments(projectId)
  const result = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, []])) as unknown as Record<DocumentCategory, DocumentRecord[]>
  for (const doc of docs) {
    result[doc.category].push(doc)
  }
  return result
}

// ─── createDocument ───────────────────────────────────────────────────────────

export async function createDocument(input: {
  projectId: string
  name: string
  category: DocumentCategory
  fileUrl: string
  fileType: string
  fileSizeBytes?: number
  accessLevel: AccessLevel
  description?: string
  tags?: string[]
}): Promise<DocumentRecord> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()

  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("documents")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      name: input.name,
      category: input.category,
      file_url: input.fileUrl,
      file_type: input.fileType,
      file_size_bytes: input.fileSizeBytes ?? null,
      version_number: 1,
      version_status: "latest_issued",
      access_level: input.accessLevel,
      uploaded_by_id: userId,
      description: input.description ?? null,
      tags: input.tags ?? null,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as DocumentRecord
}

// ─── uploadNewVersion ─────────────────────────────────────────────────────────

export async function uploadNewVersion(input: {
  previousDocumentId: string
  fileUrl: string
  fileType: string
  fileSizeBytes?: number
  description?: string
}): Promise<DocumentRecord> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: prev, error: prevErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", input.previousDocumentId)
    .eq("studio_id", studioId)
    .single()

  if (prevErr || !prev) throw new Error("Document not found")

  // Walk the chain and supersede all existing versions
  const chainIds: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = prev
  while (cursor) {
    chainIds.push(cursor.id)
    if (!cursor.previous_version_id) break
    const { data: ancestor } = await supabase
      .from("documents")
      .select("*")
      .eq("id", cursor.previous_version_id)
      .eq("studio_id", studioId)
      .single()
    cursor = ancestor ?? null
    if (!cursor) break
  }

  if (chainIds.length) {
    await supabase
      .from("documents")
      .update({ version_status: "superseded" })
      .in("id", chainIds)
      .eq("studio_id", studioId)
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      studio_id: studioId,
      project_id: prev.project_id,
      name: prev.name,
      category: prev.category,
      file_url: input.fileUrl,
      file_type: input.fileType,
      file_size_bytes: input.fileSizeBytes ?? null,
      version_number: prev.version_number + 1,
      version_status: "latest_issued",
      access_level: prev.access_level,
      uploaded_by_id: userId,
      previous_version_id: input.previousDocumentId,
      description: input.description ?? null,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath(`/dashboard/projects/${prev.project_id}`)
  return data as DocumentRecord
}

// ─── getVersionHistory ────────────────────────────────────────────────────────

export async function getVersionHistory(documentId: string): Promise<DocumentRecord[]> {
  const { supabase, studioId } = await getAuthContext()

  const versions: DocumentRecord[] = []
  let currentId: string | null = documentId

  while (currentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { data: any; error: any } = await supabase
      .from("documents")
      .select("*")
      .eq("id", currentId)
      .eq("studio_id", studioId)
      .single()

    if (result.error || !result.data) break
    versions.push(result.data as DocumentRecord)
    currentId = result.data.previous_version_id ?? null
  }

  const enriched = await enrichWithUploaders(supabase, versions)
  return enriched.sort((a, b) => b.version_number - a.version_number)
}

// ─── updateDocumentAccess ─────────────────────────────────────────────────────

export async function updateDocumentAccess(documentId: string, accessLevel: AccessLevel): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: doc } = await supabase
    .from("documents")
    .select("project_id")
    .eq("id", documentId)
    .eq("studio_id", studioId)
    .single()

  if (!doc) throw new Error("Document not found")

  const { error } = await supabase
    .from("documents")
    .update({ access_level: accessLevel })
    .eq("id", documentId)
    .eq("studio_id", studioId)

  if (error) throw error
  revalidatePath(`/dashboard/projects/${doc.project_id}`)
}

// ─── toggleShare ──────────────────────────────────────────────────────────────

export async function toggleShare(
  documentId: string,
  enabled: boolean,
  expiresAt?: string
): Promise<{ shareToken: string }> {
  const { supabase, studioId } = await getAuthContext()

  const { data: doc } = await supabase
    .from("documents")
    .select("project_id, share_token")
    .eq("id", documentId)
    .eq("studio_id", studioId)
    .single()

  if (!doc) throw new Error("Document not found")

  const { error } = await supabase
    .from("documents")
    .update({
      share_enabled: enabled,
      share_token_expires_at: expiresAt ?? null,
    })
    .eq("id", documentId)
    .eq("studio_id", studioId)

  if (error) throw error
  revalidatePath(`/dashboard/projects/${doc.project_id}`)
  return { shareToken: doc.share_token }
}

// ─── archiveDocument ──────────────────────────────────────────────────────────

export async function archiveDocument(documentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: doc } = await supabase
    .from("documents")
    .select("project_id")
    .eq("id", documentId)
    .eq("studio_id", studioId)
    .single()

  if (!doc) throw new Error("Document not found")

  const { error } = await supabase
    .from("documents")
    .update({ version_status: "archived" })
    .eq("id", documentId)
    .eq("studio_id", studioId)

  if (error) throw error
  revalidatePath(`/dashboard/projects/${doc.project_id}`)
}

// ─── unarchiveDocument ────────────────────────────────────────────────────────

// Walks the previous_version_id chain in both directions to collect every
// document that belongs to the same version group as the given document.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getVersionGroup(supabase: any, studioId: string, documentId: string): Promise<DocumentRecord[]> {
  const group = new Map<string, DocumentRecord>()
  const queue: string[] = [documentId]

  while (queue.length) {
    const id = queue.shift()!
    if (group.has(id)) continue

    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single()

    if (!data) continue
    group.set(id, data as DocumentRecord)

    if (data.previous_version_id) queue.push(data.previous_version_id)

    const { data: children } = await supabase
      .from("documents")
      .select("id")
      .eq("previous_version_id", id)
      .eq("studio_id", studioId)
    for (const child of children ?? []) queue.push(child.id)
  }

  return [...group.values()]
}

export async function unarchiveDocument(documentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("studio_id", studioId)
    .single()

  if (!doc) throw new Error("Document not found")
  if (doc.version_status !== "archived") throw new Error("Document is not archived")

  const group = await getVersionGroup(supabase, studioId, documentId)
  const hasNewerVersion = group.some((d) => d.previous_version_id === documentId)

  let newStatus: VersionStatus

  if (!hasNewerVersion) {
    // This was the newest version in its group — restoring it to latest_issued
    // is only safe if no other document in the group currently holds that status.
    const conflict = group.find((d) => d.id !== documentId && d.version_status === "latest_issued")
    if (conflict) {
      throw new Error(
        `Cannot restore "${doc.name}" (v${doc.version_number}) to Latest Issued — "${conflict.name}" (v${conflict.version_number}) already holds that status for this document group.`
      )
    }
    newStatus = "latest_issued"
  } else {
    newStatus = "superseded"
  }

  const { error } = await supabase
    .from("documents")
    .update({ version_status: newStatus })
    .eq("id", documentId)
    .eq("studio_id", studioId)

  if (error) throw error
  revalidatePath(`/dashboard/projects/${doc.project_id}`)
}

// ─── deleteDocument ───────────────────────────────────────────────────────────

export async function deleteDocument(documentId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("studio_id", studioId)
    .single()

  if (!doc) throw new Error("Document not found")
  if (doc.version_status === "latest_issued") {
    throw new Error("Cannot delete the latest issued version")
  }

  // Delete from storage: parse path from file_url
  try {
    const url = new URL(doc.file_url)
    const pathParts = url.pathname.split("/storage/v1/object/public/projectflow-files/")
    if (pathParts.length === 2) {
      await supabase.storage.from("projectflow-files").remove([pathParts[1]])
    }
  } catch {
    // Storage delete is best-effort
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("studio_id", studioId)

  if (error) throw error
  revalidatePath(`/dashboard/projects/${doc.project_id}`)
}

// ─── logDocumentAccess ────────────────────────────────────────────────────────

export async function logDocumentAccess(
  documentId: string,
  studioId: string,
  accessedByType: 'studio_member' | 'client' | 'contractor' | 'public',
  accessedById?: string,
  ipAddress?: string
): Promise<void> {
  try {
    const { supabase } = await getAuthContext().catch(() => ({ supabase: null }))
    if (!supabase) return

    await supabase.from("document_access_logs").insert({
      document_id: documentId,
      studio_id: studioId,
      accessed_by_type: accessedByType,
      accessed_by_id: accessedById ?? null,
      ip_address: ipAddress ?? null,
    })
  } catch {
    // fire-and-forget
  }
}

// ─── getDocumentAccessLog ─────────────────────────────────────────────────────

export async function getDocumentAccessLog(documentId: string): Promise<DocumentAccessLog[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("document_access_logs")
    .select("*")
    .eq("document_id", documentId)
    .eq("studio_id", studioId)
    .order("accessed_at", { ascending: false })
    .limit(50)

  if (error) throw error
  const logs: DocumentAccessLog[] = (data ?? []) as DocumentAccessLog[]

  // Enrich with user names for studio_member entries
  const userIds = logs
    .filter((l) => l.accessed_by_type === "studio_member" && l.accessed_by_id)
    .map((l) => l.accessed_by_id!)

  if (userIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds)
    const userMap: Record<string, string> = {}
    for (const u of users ?? []) userMap[u.id] = u.name
    return logs.map((l) => ({
      ...l,
      accessor_name: l.accessed_by_id ? (userMap[l.accessed_by_id] ?? null) : null,
    }))
  }

  return logs
}

// ─── getShareableDocument ─────────────────────────────────────────────────────

export async function getShareableDocument(shareToken: string): Promise<DocumentRecord | null> {
  // No auth required — public endpoint. Anonymous visitors have no Supabase
  // session, so the regular client is subject to RLS policies scoped to
  // authenticated studio members and cannot read this row. The service role
  // client bypasses RLS; authorization here is enforced in application code
  // via the token match + share_enabled + expiry check below.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("share_token", shareToken)
    .eq("share_enabled", true)
    .or("share_token_expires_at.is.null,share_token_expires_at.gt." + new Date().toISOString())
    .single()

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("getShareableDocument: query failed", { shareToken, error })
    }
    return null
  }

  // Log access (fire-and-forget)
  try {
    const { error: logError } = await supabase.from("document_access_logs").insert({
      document_id: data.id,
      studio_id: data.studio_id,
      accessed_by_type: "public",
      accessed_by_id: null,
      ip_address: null,
    })
    if (logError) console.error("getShareableDocument: access log insert failed", logError)
  } catch (err) {
    console.error("getShareableDocument: access log insert threw", err)
  }

  return data as DocumentRecord
}
