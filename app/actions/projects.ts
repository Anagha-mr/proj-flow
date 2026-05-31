"use server"

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Json } from "@/lib/supabase/types"

// ─── Helper: get current user's studio_id ────────────────────
async function getAuthContext() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.studio_id) throw new Error("No studio found")
  return { supabase, userId: user.id, studioId: profile.studio_id, role: profile.role }
}

// ─── Add offset days to a date string ────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

// ─── createProject ────────────────────────────────────────────
export async function createProject(data: {
  name: string
  type: string
  type_custom?: string | null
  status?: string
  address_line1?: string | null
  address_line2?: string | null
  address_line3?: string | null
  postcode?: string | null
  cover_image_url?: string | null
  scope_description?: string | null
  scope_items?: Array<{ id: string; text: string }>
  phases?: Array<{ id: string; name: string; start_date: string; end_date: string; status: string; color: string }>
  template_id?: string | null
  client_id?: string | null
  pinterest_url?: string | null
  members?: Array<{ userId: string; projectRole: string }>
  newClient?: { name: string; whatsapp_number?: string; email?: string } | null
}) {
  const { supabase, userId, studioId } = await getAuthContext()

  // Create a new client inline if provided
  let resolvedClientId = data.client_id ?? null
  if (data.newClient?.name) {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        studio_id: studioId,
        name: data.newClient.name,
        whatsapp_number: data.newClient.whatsapp_number ?? null,
        email: data.newClient.email ?? null,
      })
      .select("id")
      .single()

    if (clientError) throw new Error(clientError.message)
    resolvedClientId = newClient.id
  }

  // Compute phases from template if a template is selected and no phases provided
  let phases = data.phases ?? []
  if (data.template_id && phases.length > 0) {
    // Use the user-set phases as-is (they already have start/end dates from Step 3)
    // Template phases with offset_days_from_start are used only for tasks below
  }

  // Insert project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      studio_id: studioId,
      client_id: resolvedClientId,
      name: data.name,
      type: data.type,
      type_custom: data.type_custom ?? null,
      status: data.status ?? "active",
      address_line1: data.address_line1 ?? null,
      address_line2: data.address_line2 ?? null,
      address_line3: data.address_line3 ?? null,
      postcode: data.postcode ?? null,
      cover_image_url: data.cover_image_url ?? null,
      scope_description: data.scope_description ?? null,
      scope_items: data.scope_items ?? [],
      phases: phases,
      template_id: data.template_id ?? null,
      pinterest_url: data.pinterest_url ?? null,
      created_by: userId,
    })
    .select()
    .single()

  if (projectError) throw new Error(projectError.message)

  if (resolvedClientId) {
    import("@/app/actions/notifications").then(({ notifyClientProjectWelcome }) => {
      notifyClientProjectWelcome(resolvedClientId!, project.id).catch(() => {})
    }).catch(() => {})
  }

  // Insert project members (creator always included as project_lead)
  const allMembers = data.members ?? []
  const hasCreator = allMembers.some((m) => m.userId === userId)
  if (!hasCreator) allMembers.unshift({ userId, projectRole: "project_lead" })

  if (allMembers.length > 0) {
    await supabase.from("project_members").insert(
      allMembers.map((m) => ({
        project_id: project.id,
        user_id: m.userId,
        studio_id: studioId,
        project_role: m.projectRole,
      }))
    )
  }

  // Create task records from template
  if (data.template_id && phases.length > 0) {
    const { data: template } = await supabase
      .from("process_templates")
      .select("tasks, phases")
      .eq("id", data.template_id)
      .single()

    if (template?.tasks) {
      const templateTasks = template.tasks as Array<{
        title: string
        phase_name: string
        role: string
        offset_days: number
        duration_days: number
        priority: string
        dependencies: string[]
      }>

      const templatePhases = (template.phases as Array<{
        name: string
        offset_days_from_start: number
        duration_days: number
        color: string
      }>) ?? []

      // Use first phase's start_date as the project start date
      const projectStartDate = phases[0]?.start_date

      if (projectStartDate && templateTasks.length > 0) {
        const taskInserts = templateTasks.map((t) => {
          // Find the corresponding template phase to get offset_days_from_start
          const templatePhase = templatePhases.find((p) => p.name === t.phase_name)
          const phaseOffset = templatePhase?.offset_days_from_start ?? 0
          const dueDate = addDays(projectStartDate, phaseOffset + t.offset_days)

          return {
            studio_id: studioId,
            project_id: project.id,
            title: t.title,
            status: "todo",
            priority: t.priority as string,
            phase_tag: t.phase_name,
            due_date: dueDate,
          }
        })

        await supabase.from("tasks").insert(taskInserts)
      }
    }
  }

  revalidatePath("/dashboard/projects")
  return project
}

// ─── getProjects ──────────────────────────────────────────────
export async function getProjects() {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      client:clients(id, name),
      members:project_members(
        user_id,
        project_role,
        user:users(id, name, profile_photo_url)
      )
    `)
    .eq("studio_id", studioId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── getProject ───────────────────────────────────────────────
export async function getProject(id: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      client:clients(id, name, email, phone_primary, whatsapp_number),
      members:project_members(
        id,
        user_id,
        project_role,
        user:users(id, name, profile_photo_url, role)
      )
    `)
    .eq("id", id)
    .eq("studio_id", studioId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ─── updateProject ────────────────────────────────────────────
export async function updateProject(
  id: string,
  data: Partial<{
    name: string
    type: string
    type_custom: string | null
    status: string
    address_line1: string | null
    address_line2: string | null
    address_line3: string | null
    postcode: string | null
    cover_image_url: string | null
    scope_description: string | null
    scope_items: Json
    phases: Json
    pinterest_url: string | null
    client_id: string | null
    is_pinned: boolean
  }>
) {
  const { supabase, studioId } = await getAuthContext()

  const { data: updated, error } = await supabase
    .from("projects")
    .update(data)
    .eq("id", id)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/projects")
  revalidatePath(`/dashboard/projects/${id}`)
  return updated
}

// ─── deleteProject (soft-delete = archive) ───────────────────
export async function deleteProject(id: string) {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner" && role !== "senior_designer") {
    throw new Error("Insufficient permissions")
  }

  const { error } = await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/projects")
}

// ─── getProjectMembers ────────────────────────────────────────
export async function getProjectMembers(projectId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("project_members")
    .select(`
      *,
      user:users(id, name, profile_photo_url, role)
    `)
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── addProjectMember ─────────────────────────────────────────
export async function addProjectMember(
  projectId: string,
  userId: string,
  projectRole: string
) {
  const { supabase, studioId } = await getAuthContext()

  const { error } = await supabase.from("project_members").upsert({
    project_id: projectId,
    user_id: userId,
    studio_id: studioId,
    project_role: projectRole,
  }, { onConflict: "project_id,user_id" })

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${projectId}`)
}

// ─── removeProjectMember ──────────────────────────────────────
export async function removeProjectMember(projectId: string, userId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${projectId}`)
}

// ─── getClients ───────────────────────────────────────────────
export async function getClients() {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, company, email, phone_primary, whatsapp_number")
    .eq("studio_id", studioId)
    .order("name")

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── createClientRecord ───────────────────────────────────────
export async function createClientRecord(data: {
  name: string
  company?: string | null
  email?: string | null
  phone_primary?: string | null
  whatsapp_number?: string | null
}) {
  const { supabase, studioId } = await getAuthContext()

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ studio_id: studioId, ...data })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/clients")
  return client
}

// ─── getTemplates ─────────────────────────────────────────────
export async function getTemplates() {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("process_templates")
    .select("*")
    .eq("studio_id", studioId)
    .order("name")

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── getStudioUsers (for Step 4 team assignment) ──────────────
export async function getStudioUsers() {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, profile_photo_url")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("name")

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── getProjectTaskCounts ─────────────────────────────────────
export async function getProjectTaskCounts(projectId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (error) return { total: 0, todo: 0, in_progress: 0, done: 0 }

  const tasks = data ?? []
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  }
}

// ─── getUpcomingTasks ─────────────────────────────────────────
export async function getUpcomingTasks(projectId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority, phase_tag, due_date")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(3)

  if (error) return []
  return data ?? []
}

// ─── getClientsWithDetails ────────────────────────────────────
export async function getClientsWithDetails() {
  const { supabase, studioId } = await getAuthContext()

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, company, email, phone_primary, phone_secondary, whatsapp_number, portal_token, preferred_comms, available_hours, address_line1, address_line2, address_line3, postcode, state_code")
    .eq("studio_id", studioId)
    .order("name")

  if (error) throw new Error(error.message)
  const rows = clients ?? []

  if (rows.length === 0) return []

  const clientIds = rows.map((c: { id: string }) => c.id)

  const { data: projectRows } = await supabase
    .from("projects")
    .select("client_id")
    .eq("studio_id", studioId)
    .in("client_id", clientIds)

  const projectCount: Record<string, number> = {}
  ;(projectRows ?? []).forEach((p: { client_id: string | null }) => {
    if (p.client_id) projectCount[p.client_id] = (projectCount[p.client_id] ?? 0) + 1
  })

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("client_id")
    .eq("studio_id", studioId)
    .in("client_id", clientIds)
    .in("status", ["sent", "partial", "overdue"])

  const outstandingCount: Record<string, number> = {}
  ;(invoiceRows ?? []).forEach((i: { client_id: string }) => {
    outstandingCount[i.client_id] = (outstandingCount[i.client_id] ?? 0) + 1
  })

  return rows.map((c: { id: string }) => ({
    ...(c as Record<string, unknown>),
    project_count: projectCount[c.id] ?? 0,
    outstanding_invoices: outstandingCount[c.id] ?? 0,
  }))
}

// ─── createClient (full fields) ───────────────────────────────
export async function createClient(data: {
  name: string
  company?: string | null
  email?: string | null
  phone_primary?: string | null
  phone_secondary?: string | null
  whatsapp_number?: string | null
  address_line1?: string | null
  address_line2?: string | null
  address_line3?: string | null
  postcode?: string | null
  state_code?: string | null
  preferred_comms?: string | null
  available_hours?: string | null
}) {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client, error } = await supabase
    .from("clients")
    .insert({ studio_id: studioId, ...data } as any)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/clients")
  return client
}

// ─── updateProjectNarrativeSettings ──────────────────────────
export async function updateProjectNarrativeSettings(
  projectId: string,
  settings: { frequency: string; language: string }
): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') {
    throw new Error('Insufficient permissions')
  }

  const { error } = await supabase
    .from('projects')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ narrative_frequency: settings.frequency, narrative_language: settings.language } as any)
    .eq('id', projectId)
    .eq('studio_id', studioId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${projectId}/overview`)
}

// ─── updateClient ─────────────────────────────────────────────
export async function updateClient(
  clientId: string,
  data: Partial<{
    name: string
    company: string | null
    email: string | null
    phone_primary: string | null
    phone_secondary: string | null
    whatsapp_number: string | null
    address_line1: string | null
    address_line2: string | null
    address_line3: string | null
    postcode: string | null
    state_code: string | null
    preferred_comms: string | null
    available_hours: string | null
  }>
) {
  const { supabase, studioId } = await getAuthContext()

  // Cast because the generated Update type is narrower than the actual table schema
  const { data: client, error } = await supabase
    .from("clients")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(data as any)
    .eq("id", clientId)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/clients")
  return client
}

// ─── deleteClient ─────────────────────────────────────────────
export async function deleteClient(clientId: string): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== "owner" && role !== "senior_designer") {
    throw new Error("Insufficient permissions")
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/clients")
}

// ─── regeneratePortalToken ────────────────────────────────────
export async function regeneratePortalToken(clientId: string): Promise<string> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("studio_id", studioId)
    .single()
  if (!existing) throw new Error("Client not found")

  const newToken = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("clients")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ portal_token: newToken, portal_token_expires_at: expiresAt.toISOString() } as any)
    .eq("id", clientId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/clients")
  return newToken
}

// ─── updateProjectContractValue ───────────────────────────────────────────────

export async function updateProjectContractValue(
  projectId: string,
  contractValue: number | null
): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') {
    throw new Error('Only owners and senior designers can set the contract value')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('studio_id', studioId)
    .single()

  if (!project) throw new Error('Project not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('projects') as any)
    .update({ contract_value: contractValue })
    .eq('id', projectId)
    .eq('studio_id', studioId)

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/finance')
}

// ─── getProjectName (Sprint 15 — lightweight for sidebar / breadcrumb) ────────
export async function getProjectName(projectId: string): Promise<string | null> {
  try {
    const { supabase, studioId } = await getAuthContext()
    const { data } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .eq("studio_id", studioId)
      .single()
    return data?.name ?? null
  } catch {
    return null
  }
}

// ─── SearchIndex types & getSearchIndex (Sprint 15 — command palette) ─────────
export interface SearchIndex {
  projects:  Array<{ id: string; name: string; client_name: string }>
  tasks:     Array<{ id: string; title: string; project_id: string; project_name: string }>
  documents: Array<{ id: string; name: string; project_id: string; project_name: string }>
}

export async function getSearchIndex(): Promise<SearchIndex> {
  const { supabase, studioId } = await getAuthContext()

  const [projectsRes, tasksRes, documentsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .eq("studio_id", studioId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("studio_id", studioId)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("documents")
      .select("id, name, project_id")
      .eq("studio_id", studioId)
      .order("uploaded_at", { ascending: false })
      .limit(300),
  ])

  // Build project name lookup map
  const projectRows = (projectsRes.data ?? []) as Array<{
    id: string
    name: string
    client: { name: string } | null
  }>
  const nameMap: Record<string, string> = {}
  projectRows.forEach((p) => { nameMap[p.id] = p.name })

  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client?.name ?? "",
  }))

  const tasks = ((tasksRes.data ?? []) as Array<{ id: string; title: string; project_id: string }>)
    .map((t) => ({
      id: t.id,
      title: t.title,
      project_id: t.project_id,
      project_name: nameMap[t.project_id] ?? "",
    }))

  const documents = ((documentsRes.data ?? []) as Array<{ id: string; name: string; project_id: string }>)
    .map((d) => ({
      id: d.id,
      name: d.name,
      project_id: d.project_id,
      project_name: nameMap[d.project_id] ?? "",
    }))

  return { projects, tasks, documents }
}
