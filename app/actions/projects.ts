"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Json } from "@/lib/supabase/types"

// ─── Helper: get current user's studio_id ────────────────────
async function getAuthContext() {
  const supabase = await createClient()
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

  // WhatsApp stub log when client is linked
  if (resolvedClientId) {
    console.log(
      "[WhatsApp stub] project_welcome_client → client_id:",
      resolvedClientId,
      "project:",
      data.name
    )
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
