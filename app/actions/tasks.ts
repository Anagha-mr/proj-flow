"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"

// ─── Shared Types ──────────────────────────────────────────────

export type TaskAssignee = {
  id: string
  name: string
  profile_photo_url: string | null
}

export type TaskWithDetails = {
  id: string
  studio_id: string
  project_id: string
  parent_task_id: string | null
  title: string
  description: string | null
  status: string
  priority: string
  phase_tag: string | null
  room_tag: string | null
  start_date: string | null
  due_date: string | null
  progress_percent: number
  is_recurring: boolean
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  assignees: TaskAssignee[]
  subtask_count: number
  attachment_count: number
}

export type TaskComment = {
  id: string
  task_id: string
  body: string
  is_client_visible: boolean
  author_id: string
  created_at: string
  updated_at: string
  author: { id: string; name: string; profile_photo_url: string | null } | null
}

export type TaskAttachment = {
  id: string
  task_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
  uploaded_by_id: string
  uploader: { id: string; name: string } | null
}

// ─── Helper: build task list with counts ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichTasks(supabase: any, studioId: string, rawTasks: any[]): Promise<TaskWithDetails[]> {
  if (!rawTasks.length) return []

  const taskIds = rawTasks.map((t) => t.id)

  const [{ data: subtasksData }, { data: attachmentsData }] = await Promise.all([
    supabase
      .from("tasks")
      .select("parent_task_id")
      .in("parent_task_id", taskIds)
      .eq("studio_id", studioId),
    supabase
      .from("task_attachments")
      .select("task_id")
      .in("task_id", taskIds)
      .eq("studio_id", studioId),
  ])

  const subtaskCountMap = new Map<string, number>()
  subtasksData?.forEach((s: { parent_task_id: string }) => {
    if (s.parent_task_id)
      subtaskCountMap.set(s.parent_task_id, (subtaskCountMap.get(s.parent_task_id) ?? 0) + 1)
  })

  const attachmentCountMap = new Map<string, number>()
  attachmentsData?.forEach((a: { task_id: string }) => {
    attachmentCountMap.set(a.task_id, (attachmentCountMap.get(a.task_id) ?? 0) + 1)
  })

  return rawTasks.map((task) => ({
    id: task.id,
    studio_id: task.studio_id,
    project_id: task.project_id,
    parent_task_id: task.parent_task_id ?? null,
    title: task.title,
    description: task.description ?? null,
    status: task.status ?? "todo",
    priority: task.priority ?? "medium",
    phase_tag: task.phase_tag ?? null,
    room_tag: task.room_tag ?? null,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    progress_percent: task.progress_percent ?? 0,
    is_recurring: task.is_recurring ?? false,
    position: task.position ?? 0,
    created_by: task.created_by ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
    assignees: (task.task_assignees ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ta: any) => ta.user)
      .filter(Boolean) as TaskAssignee[],
    subtask_count: subtaskCountMap.get(task.id) ?? 0,
    attachment_count: attachmentCountMap.get(task.id) ?? 0,
  }))
}

// ─── getTasks ─────────────────────────────────────────────────

export async function getTasks(projectId: string): Promise<TaskWithDetails[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id, studio_id, project_id, parent_task_id, title, description,
      status, priority, phase_tag, room_tag, start_date, due_date,
      progress_percent, is_recurring, position, created_by, created_at, updated_at
    `)
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .is("parent_task_id", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  if (!tasks?.length) return []

  const taskIds = tasks.map((t) => t.id)

  // Fetch assignees separately to avoid RLS join issues
  const { data: assigneesRaw } = await supabase
    .from("task_assignees")
    .select("task_id, user:users(id, name, profile_photo_url)")
    .in("task_id", taskIds)
    .eq("studio_id", studioId)

  const assigneeMap = new Map<string, TaskAssignee[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assigneesRaw?.forEach((a: any) => {
    if (!a.user) return
    const list = assigneeMap.get(a.task_id) ?? []
    list.push(a.user)
    assigneeMap.set(a.task_id, list)
  })

  const tasksWithAssignees = tasks.map((t) => ({
    ...t,
    task_assignees: (assigneeMap.get(t.id) ?? []).map((u) => ({ user: u })),
  }))

  return enrichTasks(supabase, studioId, tasksWithAssignees)
}

// ─── getSubtasks ──────────────────────────────────────────────

export async function getSubtasks(parentTaskId: string): Promise<TaskWithDetails[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id, studio_id, project_id, parent_task_id, title, description,
      status, priority, phase_tag, room_tag, start_date, due_date,
      progress_percent, is_recurring, position, created_by, created_at, updated_at,
      task_assignees(user_id, user:users(id, name, profile_photo_url))
    `)
    .eq("parent_task_id", parentTaskId)
    .eq("studio_id", studioId)
    .order("position", { ascending: true })

  if (error) throw new Error(error.message)
  return enrichTasks(supabase, studioId, tasks ?? [])
}

// ─── createTask ───────────────────────────────────────────────

export async function createTask(data: {
  project_id: string
  title: string
  description?: string | null
  status?: string
  priority?: string
  phase_tag?: string | null
  room_tag?: string | null
  start_date?: string | null
  due_date?: string | null
  parent_task_id?: string | null
  assignee_ids?: string[]
}): Promise<TaskWithDetails> {
  const { supabase, userId, studioId } = await getAuthContext()

  const status = data.status ?? "todo"

  // Compute position at end of status column
  const { data: maxPosRow } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", data.project_id)
    .eq("studio_id", studioId)
    .eq("status", status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxPosRow?.position ?? 0) + 1

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      studio_id: studioId,
      project_id: data.project_id,
      title: data.title,
      description: data.description ?? null,
      status,
      priority: data.priority ?? "medium",
      phase_tag: data.phase_tag ?? null,
      room_tag: data.room_tag ?? null,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      parent_task_id: data.parent_task_id ?? null,
      created_by: userId,
      position,
    })
    .select("id, studio_id, project_id, parent_task_id, title, description, status, priority, phase_tag, room_tag, start_date, due_date, progress_percent, is_recurring, position, created_by, created_at, updated_at")
    .single()

  if (error) throw new Error(error.message)

  // Assign users
  const assigneeIds = data.assignee_ids?.length ? data.assignee_ids : [userId]
  await supabase.from("task_assignees").insert(
    assigneeIds.map((uid) => ({
      task_id: task.id,
      user_id: uid,
      studio_id: studioId,
      assigned_by_id: userId,
    }))
  )

  revalidatePath(`/dashboard/projects/${data.project_id}`)

  // Fetch the assignees for the returned object
  const { data: assigneesRaw } = await supabase
    .from("task_assignees")
    .select("user:users(id, name, profile_photo_url)")
    .eq("task_id", task.id)

  return {
    ...task,
    room_tag: task.room_tag ?? null,
    progress_percent: task.progress_percent ?? 0,
    is_recurring: task.is_recurring ?? false,
    position: task.position ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignees: (assigneesRaw ?? []).map((a: any) => a.user).filter(Boolean),
    subtask_count: 0,
    attachment_count: 0,
  }
}

// ─── updateTask ───────────────────────────────────────────────

export async function updateTask(
  id: string,
  data: Partial<{
    title: string
    description: string | null
    status: string
    priority: string
    phase_tag: string | null
    room_tag: string | null
    start_date: string | null
    due_date: string | null
    progress_percent: number
    parent_task_id: string | null
  }>
) {
  const { supabase, studioId } = await getAuthContext()

  let positionOverride: number | undefined
  if (data.status) {
    const { data: maxPosRow } = await supabase
      .from("tasks")
      .select("position, project_id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single()

    if (maxPosRow) {
      const { data: maxPos } = await supabase
        .from("tasks")
        .select("position")
        .eq("studio_id", studioId)
        .eq("project_id", maxPosRow.project_id)
        .eq("status", data.status)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()
      positionOverride = (maxPos?.position ?? 0) + 1
    }
  }

  if (positionOverride !== undefined) {
    await supabase.from("tasks").update({ position: positionOverride }).eq("id", id).eq("studio_id", studioId)
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", id)
    .eq("studio_id", studioId)
    .select("project_id")
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${updated.project_id}`)
  return updated
}

// ─── deleteTask ───────────────────────────────────────────────

export async function deleteTask(id: string) {
  const { supabase, studioId } = await getAuthContext()

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", id)
    .eq("studio_id", studioId)
    .single()

  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("studio_id", studioId)
  if (error) throw new Error(error.message)

  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)
}

// ─── updateTaskStatus ─────────────────────────────────────────

export async function updateTaskStatus(id: string, status: string, newPosition?: number) {
  const { supabase, studioId } = await getAuthContext()

  let position = newPosition
  if (position === undefined) {
    const { data: taskRow } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", id)
      .single()

    if (taskRow?.project_id) {
      const { data: maxPos } = await supabase
        .from("tasks")
        .select("position")
        .eq("studio_id", studioId)
        .eq("project_id", taskRow.project_id)
        .eq("status", status)
        .neq("id", id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()
      position = (maxPos?.position ?? 0) + 1
    }
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status, ...(position !== undefined ? { position } : {}) })
    .eq("id", id)
    .eq("studio_id", studioId)
    .select("project_id")
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${updated.project_id}`)
}

// ─── reorderTasks ─────────────────────────────────────────────

export async function reorderTasks(updates: Array<{ id: string; position: number; status: string }>) {
  const { supabase, studioId } = await getAuthContext()

  await Promise.all(
    updates.map(({ id, position, status }) =>
      supabase
        .from("tasks")
        .update({ position, status })
        .eq("id", id)
        .eq("studio_id", studioId)
    )
  )
}

// ─── getTaskComments ──────────────────────────────────────────

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, body, is_client_visible, author_id, created_at, updated_at, author:users(id, name, profile_photo_url)")
    .eq("task_id", taskId)
    .eq("studio_id", studioId)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((c) => ({
    id: c.id,
    task_id: c.task_id,
    body: c.body,
    is_client_visible: c.is_client_visible,
    author_id: c.author_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    author: (c.author as any) ?? null,
  }))
}

// ─── addTaskComment ───────────────────────────────────────────

export async function addTaskComment(
  taskId: string,
  body: string,
  isClientVisible = false
): Promise<TaskComment> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single()

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      studio_id: studioId,
      author_id: userId,
      author_type: "internal",
      body,
      is_client_visible: isClientVisible,
    })
    .select("id, task_id, body, is_client_visible, author_id, created_at, updated_at, author:users(id, name, profile_photo_url)")
    .single()

  if (error) throw new Error(error.message)
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)

  return {
    id: data.id,
    task_id: data.task_id,
    body: data.body,
    is_client_visible: data.is_client_visible,
    author_id: data.author_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    author: (data.author as any) ?? null,
  }
}

// ─── deleteTaskComment ────────────────────────────────────────

export async function deleteTaskComment(commentId: string) {
  const { supabase, userId, studioId, role } = await getAuthContext()

  const { data: comment } = await supabase
    .from("task_comments")
    .select("author_id, task_id")
    .eq("id", commentId)
    .eq("studio_id", studioId)
    .single()

  if (!comment) throw new Error("Comment not found")
  if (comment.author_id !== userId && role !== "owner") throw new Error("Insufficient permissions")

  const { error } = await supabase.from("task_comments").delete().eq("id", commentId)
  if (error) throw new Error(error.message)
}

// ─── addTaskAttachment ────────────────────────────────────────

export async function addTaskAttachment(
  taskId: string,
  fileUrl: string,
  fileName: string,
  fileType: string | null,
  fileSizeBytes: number | null
): Promise<TaskAttachment> {
  const { supabase, userId, studioId } = await getAuthContext()

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single()

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      studio_id: studioId,
      uploaded_by_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
    })
    .select("id, task_id, file_name, file_url, file_type, file_size_bytes, uploaded_at, uploaded_by_id, uploader:users(id, name)")
    .single()

  if (error) throw new Error(error.message)
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)

  return {
    id: data.id,
    task_id: data.task_id,
    file_name: data.file_name,
    file_url: data.file_url,
    file_type: data.file_type ?? null,
    file_size_bytes: data.file_size_bytes ?? null,
    uploaded_at: data.uploaded_at,
    uploaded_by_id: data.uploaded_by_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploader: (data.uploader as any) ?? null,
  }
}

// ─── deleteTaskAttachment ─────────────────────────────────────

export async function deleteTaskAttachment(attachmentId: string) {
  const { supabase, userId, studioId, role } = await getAuthContext()

  const { data: att } = await supabase
    .from("task_attachments")
    .select("uploaded_by_id")
    .eq("id", attachmentId)
    .eq("studio_id", studioId)
    .single()

  if (!att) throw new Error("Attachment not found")
  if (att.uploaded_by_id !== userId && role !== "owner") throw new Error("Insufficient permissions")

  const { error } = await supabase.from("task_attachments").delete().eq("id", attachmentId)
  if (error) throw new Error(error.message)
}

// ─── getTaskAttachments ───────────────────────────────────────

export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, task_id, file_name, file_url, file_type, file_size_bytes, uploaded_at, uploaded_by_id, uploader:users(id, name)")
    .eq("task_id", taskId)
    .eq("studio_id", studioId)
    .order("uploaded_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((a) => ({
    id: a.id,
    task_id: a.task_id,
    file_name: a.file_name,
    file_url: a.file_url,
    file_type: a.file_type ?? null,
    file_size_bytes: a.file_size_bytes ?? null,
    uploaded_at: a.uploaded_at,
    uploaded_by_id: a.uploaded_by_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploader: (a.uploader as any) ?? null,
  }))
}

// ─── addTaskDependency ────────────────────────────────────────

export async function addTaskDependency(taskId: string, dependsOnTaskId: string) {
  const { supabase, studioId } = await getAuthContext()

  // One-level circular check: does dependsOnTaskId already depend on taskId?
  const { data: existing } = await supabase
    .from("task_dependencies")
    .select("id")
    .eq("task_id", dependsOnTaskId)
    .eq("depends_on_task_id", taskId)
    .eq("studio_id", studioId)
    .maybeSingle()

  if (existing) throw new Error("Circular dependency detected")

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId, studio_id: studioId })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)

  return data
}

// ─── removeTaskDependency ─────────────────────────────────────

export async function removeTaskDependency(taskId: string, dependsOnTaskId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_task_id", dependsOnTaskId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)

  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)
}

// ─── getTaskDependencies ──────────────────────────────────────

export type TaskDependency = {
  id: string
  task_id: string
  depends_on_task_id: string
  task: { id: string; title: string; status: string; due_date: string | null }
  depends_on_task: { id: string; title: string; status: string; due_date: string | null }
}

export async function getTaskDependencies(projectId: string): Promise<TaskDependency[]> {
  const { supabase, studioId } = await getAuthContext()

  // Fetch all task IDs in this project first
  const { data: projectTasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)

  if (!projectTasks?.length) return []

  const projectTaskIds = projectTasks.map((t) => t.id)

  const { data, error } = await supabase
    .from("task_dependencies")
    .select("id, task_id, depends_on_task_id")
    .in("task_id", projectTaskIds)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  // Collect all task IDs we need details for
  const allIds = [...new Set([...data.map((d) => d.task_id), ...data.map((d) => d.depends_on_task_id)])]

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("id, title, status, due_date")
    .in("id", allIds)
    .eq("studio_id", studioId)

  const taskMap = new Map((tasksData ?? []).map((t) => [t.id, t]))

  return data.map((d) => ({
    id: d.id,
    task_id: d.task_id,
    depends_on_task_id: d.depends_on_task_id,
    task: taskMap.get(d.task_id) ?? { id: d.task_id, title: "Unknown", status: "todo", due_date: null },
    depends_on_task: taskMap.get(d.depends_on_task_id) ?? { id: d.depends_on_task_id, title: "Unknown", status: "todo", due_date: null },
  }))
}

// ─── updateTaskAssignees ──────────────────────────────────────

export async function addTaskAssignee(taskId: string, assigneeUserId: string) {
  const { supabase, userId, studioId } = await getAuthContext()

  const { error } = await supabase.from("task_assignees").upsert(
    { task_id: taskId, user_id: assigneeUserId, studio_id: studioId, assigned_by_id: userId },
    { onConflict: "task_id,user_id" }
  )
  if (error) throw new Error(error.message)

  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)
}

export async function removeTaskAssignee(taskId: string, assigneeUserId: string) {
  const { supabase, studioId } = await getAuthContext()

  const { error } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", assigneeUserId)
    .eq("studio_id", studioId)

  if (error) throw new Error(error.message)

  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()
  if (task?.project_id) revalidatePath(`/dashboard/projects/${task.project_id}`)
}

// ─── Sprint 16: getMyTasksToday ───────────────────────────────────────────────

export interface MyTask {
  id: string
  title: string
  projectId: string
  projectName: string
  dueDate: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export async function getMyTasksToday(): Promise<MyTask[]> {
  const { supabase, userId } = await getAuthContext()

  const today = new Date().toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch task assignee rows for this user
  const { data: assigneeRows } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', userId)

  const taskIds = (assigneeRows ?? []).map((a) => a.task_id)
  if (taskIds.length === 0) return []

  // Fetch tasks due within 7 days (not done)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, project_id, due_date, status, priority')
    .in('id', taskIds)
    .neq('status', 'done')
    .lte('due_date', in7Days)

  if (!tasks || tasks.length === 0) return []

  // Fetch project names separately
  const projectIds = [...new Set(tasks.map((t) => t.project_id))]
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)

  const projectNameMap: Record<string, string> = {}
  for (const p of projects ?? []) projectNameMap[p.id] = p.name

  const result: MyTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectId: t.project_id,
    projectName: projectNameMap[t.project_id] ?? 'Unknown',
    dueDate: t.due_date ?? today,
    status: (t.status ?? 'todo') as MyTask['status'],
    priority: (t.priority ?? 'medium') as MyTask['priority'],
  }))

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

  // Sort: overdue first, then by due_date ASC, then priority DESC
  result.sort((a, b) => {
    const aOverdue = a.dueDate < today
    const bOverdue = b.dueDate < today
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    const dateDiff = a.dueDate.localeCompare(b.dueDate)
    if (dateDiff !== 0) return dateDiff
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  })

  return result.slice(0, 10)
}
