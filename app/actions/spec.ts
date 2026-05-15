"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

export interface SpecRevision {
  changed_by_id: string
  changed_at: string
  field_name: string
  old_value: string
  new_value: string
  reason: string
}

export interface SpecItem {
  id: string
  studio_id: string
  project_id: string
  space: string
  surface: "floor" | "wall" | "ceiling" | "joinery" | "other"
  material_name: string
  finish_type: string | null
  supplier: string | null
  location_notes: string | null
  dimensions: string | null
  drawing_reference: string | null
  linked_procurement_id: string | null
  revisions: SpecRevision[]
  created_by_id: string | null
  created_at: string
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

const EDITABLE_FIELDS = [
  "space",
  "surface",
  "material_name",
  "finish_type",
  "supplier",
  "location_notes",
  "dimensions",
  "drawing_reference",
  "linked_procurement_id",
] as const

export async function getSpecItems(projectId: string): Promise<SpecItem[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data, error } = await (supabase.from as AnyQuery)("spec_items")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("space", { ascending: true })
    .order("surface", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as SpecItem[]
}

export async function createSpecItem(input: {
  projectId: string
  space: string
  surface: SpecItem["surface"]
  materialName: string
  finishType?: string
  supplier?: string
  locationNotes?: string
  dimensions?: string
  drawingReference?: string
  linkedProcurementId?: string
}): Promise<SpecItem> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data, error } = await (supabase.from as AnyQuery)("spec_items")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      space: input.space,
      surface: input.surface,
      material_name: input.materialName,
      finish_type: input.finishType ?? null,
      supplier: input.supplier ?? null,
      location_notes: input.locationNotes ?? null,
      dimensions: input.dimensions ?? null,
      drawing_reference: input.drawingReference ?? null,
      linked_procurement_id: input.linkedProcurementId ?? null,
      created_by_id: userId,
      revisions: [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)
  return data as SpecItem
}

export async function updateSpecItem(
  itemId: string,
  updates: Partial<Omit<SpecItem, "id" | "studio_id" | "project_id" | "revisions" | "created_at" | "updated_at">>,
  reason: string
): Promise<SpecItem> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: existing } = await (supabase.from as AnyQuery)("spec_items")
    .select("*")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!existing) throw new Error("Spec item not found")

  const currentRevisions: SpecRevision[] = (existing.revisions as SpecRevision[]) ?? []
  const newRevisions: SpecRevision[] = []
  const dbUpdates: Record<string, unknown> = {}

  const fieldToDb: Record<string, string> = {
    space: "space",
    surface: "surface",
    material_name: "material_name",
    finish_type: "finish_type",
    supplier: "supplier",
    location_notes: "location_notes",
    dimensions: "dimensions",
    drawing_reference: "drawing_reference",
    linked_procurement_id: "linked_procurement_id",
    created_by_id: "created_by_id",
  }

  for (const key of EDITABLE_FIELDS) {
    if (updates[key] === undefined) continue
    const oldVal = (existing as Record<string, unknown>)[key]
    const newVal = updates[key]
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      newRevisions.push({
        changed_by_id: userId,
        changed_at: new Date().toISOString(),
        field_name: key,
        old_value: String(oldVal ?? ""),
        new_value: String(newVal ?? ""),
        reason,
      })
      dbUpdates[fieldToDb[key] ?? key] = newVal
    }
  }

  if (Object.keys(dbUpdates).length === 0) return existing as SpecItem

  dbUpdates.revisions = [...currentRevisions, ...newRevisions]

  const { data, error } = await (supabase.from as AnyQuery)("spec_items")
    .update(dbUpdates)
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${existing.project_id}`)
  return data as SpecItem
}

export async function importFromProcurement(
  projectId: string,
  scheduleId: string
): Promise<SpecItem[]> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: procItems } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("schedule_id", scheduleId)
    .in("curation_status", ["internally_approved", "client_review", "approved"])

  const items = (procItems ?? []) as Array<{
    id: string
    room_or_category: string | null
    name: string
    finish?: string | null
    supplier_name?: string | null
    dimensions_length?: number | null
    dimensions_height?: number | null
    dimensions_depth?: number | null
  }>

  if (items.length === 0) return []

  const { data: existingSpecs } = await (supabase.from as AnyQuery)("spec_items")
    .select("linked_procurement_id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .not("linked_procurement_id", "is", null)

  const alreadyLinked = new Set((existingSpecs ?? []).map((s: { linked_procurement_id: string }) => s.linked_procurement_id))

  const toInsert = items
    .filter((item) => !alreadyLinked.has(item.id))
    .map((item) => {
      const dimParts = [item.dimensions_length, item.dimensions_height, item.dimensions_depth]
        .filter((v) => v != null)
        .map(String)
      const dimensions = dimParts.length > 0 ? dimParts.join("×") + "mm" : null

      return {
        studio_id: studioId,
        project_id: projectId,
        space: item.room_or_category ?? "Uncategorised",
        surface: "other",
        material_name: item.name,
        finish_type: item.finish ?? null,
        supplier: item.supplier_name ?? null,
        dimensions,
        linked_procurement_id: item.id,
        created_by_id: userId,
        revisions: [],
      }
    })

  if (toInsert.length === 0) return []

  const { data: inserted, error } = await (supabase.from as AnyQuery)("spec_items")
    .insert(toInsert)
    .select()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${projectId}`)
  return (inserted ?? []) as SpecItem[]
}

export async function deleteSpecItem(itemId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: item } = await (supabase.from as AnyQuery)("spec_items")
    .select("project_id")
    .eq("id", itemId)
    .eq("studio_id", studioId)
    .single()
  if (!item) throw new Error("Spec item not found")

  const { error } = await (supabase.from as AnyQuery)("spec_items")
    .delete()
    .eq("id", itemId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${item.project_id}`)
}

export async function getProcurementSchedulesForProject(projectId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("procurement_schedules")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ id: string; name: string }>
}
