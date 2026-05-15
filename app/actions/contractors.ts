"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

export interface Contractor {
  id: string
  studio_id: string
  company_name: string
  company_type: string | null
  contact_name: string
  phone: string
  email: string | null
  whatsapp_number: string | null
  address: string | null
  gstin: string | null
  tax_bracket: string | null
  site_supervisor_name: string | null
  site_supervisor_phone: string | null
  contractor_token: string
  contractor_token_expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getContractors(): Promise<Contractor[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("company_name", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Contractor[]
}

export async function getProjectContractors(projectId: string): Promise<Contractor[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data: links } = await supabase
    .from("project_contractors")
    .select("contractor_id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (!links || links.length === 0) return []

  const contractorIds = links.map((l) => l.contractor_id)

  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .in("id", contractorIds)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Contractor[]
}

export async function createContractor(input: {
  companyName: string
  companyType?: string
  contactName: string
  phone: string
  email?: string
  whatsappNumber?: string
  address?: string
  gstin?: string
  taxBracket?: string
  siteSupervisorName?: string
  siteSupervisorPhone?: string
}): Promise<Contractor> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("contractors")
    .insert({
      studio_id: studioId,
      company_name: input.companyName,
      company_type: input.companyType ?? null,
      contact_name: input.contactName,
      phone: input.phone,
      email: input.email ?? null,
      whatsapp_number: input.whatsappNumber ?? null,
      address: input.address ?? null,
      gstin: input.gstin ?? null,
      tax_bracket: input.taxBracket ?? null,
      site_supervisor_name: input.siteSupervisorName ?? null,
      site_supervisor_phone: input.siteSupervisorPhone ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/contractors')
  return data as unknown as Contractor
}

export async function updateContractor(
  contractorId: string,
  updates: Partial<Omit<Contractor, 'id' | 'studio_id' | 'contractor_token' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("contractors")
    .select("studio_id")
    .eq("id", contractorId)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Contractor not found")

  const payload: Record<string, unknown> = {}
  if (updates.company_name !== undefined) payload.company_name = updates.company_name
  if (updates.company_type !== undefined) payload.company_type = updates.company_type
  if (updates.contact_name !== undefined) payload.contact_name = updates.contact_name
  if (updates.phone !== undefined) payload.phone = updates.phone
  if (updates.email !== undefined) payload.email = updates.email
  if (updates.whatsapp_number !== undefined) payload.whatsapp_number = updates.whatsapp_number
  if (updates.address !== undefined) payload.address = updates.address
  if (updates.gstin !== undefined) payload.gstin = updates.gstin
  if (updates.tax_bracket !== undefined) payload.tax_bracket = updates.tax_bracket
  if (updates.site_supervisor_name !== undefined) payload.site_supervisor_name = updates.site_supervisor_name
  if (updates.site_supervisor_phone !== undefined) payload.site_supervisor_phone = updates.site_supervisor_phone
  if (updates.is_active !== undefined) payload.is_active = updates.is_active
  if (updates.contractor_token_expires_at !== undefined) payload.contractor_token_expires_at = updates.contractor_token_expires_at

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase
    .from("contractors")
    .update(payload as any)
    .eq("id", contractorId)
    .eq("studio_id", studioId)

  revalidatePath('/dashboard/contractors')
}

export async function assignContractorToProject(
  contractorId: string,
  projectId: string,
  scopeNotes?: string
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const [{ data: contractor }, { data: project }] = await Promise.all([
    supabase.from("contractors").select("studio_id").eq("id", contractorId).single(),
    supabase.from("projects").select("studio_id").eq("id", projectId).single(),
  ])

  if (!contractor || contractor.studio_id !== studioId) throw new Error("Contractor not found")
  if (!project || project.studio_id !== studioId) throw new Error("Project not found")

  await supabase
    .from("project_contractors")
    .upsert(
      {
        project_id: projectId,
        contractor_id: contractorId,
        studio_id: studioId,
        scope_notes: scopeNotes ?? null,
      },
      { onConflict: "project_id,contractor_id", ignoreDuplicates: true }
    )

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function removeContractorFromProject(
  contractorId: string,
  projectId: string
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const [{ data: contractor }, { data: project }] = await Promise.all([
    supabase.from("contractors").select("studio_id").eq("id", contractorId).single(),
    supabase.from("projects").select("studio_id").eq("id", projectId).single(),
  ])

  if (!contractor || contractor.studio_id !== studioId) throw new Error("Contractor not found")
  if (!project || project.studio_id !== studioId) throw new Error("Project not found")

  await supabase
    .from("project_contractors")
    .delete()
    .eq("project_id", projectId)
    .eq("contractor_id", contractorId)
    .eq("studio_id", studioId)

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function regenerateContractorToken(contractorId: string): Promise<string> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("contractors")
    .select("studio_id")
    .eq("id", contractorId)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Contractor not found")

  const { data: updated, error: updateError } = await supabase
    .from("contractors")
    .update({
      contractor_token: crypto.randomUUID(),
      contractor_token_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", contractorId)
    .eq("studio_id", studioId)
    .select("contractor_token")
    .single()

  if (updateError) throw new Error(updateError.message)
  revalidatePath('/dashboard/contractors')
  return (updated as unknown as { contractor_token: string }).contractor_token
}

export async function getContractorProjectCount(contractorId: string): Promise<number> {
  const { supabase, studioId } = await getAuthContext()

  const { count } = await supabase
    .from("project_contractors")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractorId)
    .eq("studio_id", studioId)

  return count ?? 0
}
