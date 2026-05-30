"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import { buildSystemPrompt } from "@/lib/utils/ai-prompt"
import { createTask } from "./tasks"
import { updateTask } from "./tasks"
import { createMeeting } from "./meetings"
import { sendWhatsAppMessage } from "./notifications"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  action_proposal?: ActionProposal
}

export interface CreateTaskPayload {
  title: string
  project_id: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  description: string | null
}

export interface SendWhatsAppPayload {
  recipient_name: string
  recipient_phone: string
  message_text: string
  project_id: string
}

export interface UpdateTaskStatusPayload {
  task_id: string
  task_title: string
  new_status: 'todo' | 'in_progress' | 'review' | 'done'
}

export interface CreateMeetingNotePayload {
  project_id: string
  title: string
  attendees: string[]
  decisions: string[]
  action_items: Array<{ description: string; assigned_to: string | null; due_date: string | null }>
}

export interface ActionProposal {
  type: 'create_task' | 'send_whatsapp' | 'update_task_status' | 'create_meeting_note'
  payload: CreateTaskPayload | SendWhatsAppPayload | UpdateTaskStatusPayload | CreateMeetingNotePayload
  status: 'pending' | 'confirmed' | 'dismissed'
  display_label: string
}

export interface ProjectContext {
  project: {
    id: string
    name: string
    status: string
    client_name: string
    contract_value: number | null
    health_score: string
  }
  overdue_tasks: Array<{ id: string; title: string; due_date: string; assigned_to: string | null }>
  pending_rfis: Array<{ id: string; title: string; days_open: number }>
  pending_procurement: Array<{ id: string; item_name: string; schedule_name: string; status: string }>
  outstanding_invoices: Array<{ id: string; invoice_number: string; total: number; days_overdue: number }>
  recent_site_updates: Array<{ id: string; note: string; submitted_at: string }>
  team_members: Array<{ id: string; name: string; role: string }>
}

// ─── getProjectContext ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any

export async function getProjectContext(projectId: string): Promise<ProjectContext> {
  const { supabase, studioId } = await getAuthContext()

  const [
    projectResult,
    overdueTasksResult,
    rfisResult,
    procurementResult,
    invoicesResult,
    siteUpdatesResult,
    teamResult,
  ] = await Promise.all([
    // Project (uses any cast for health_score which was added in sprint 16 migration)
    (supabase.from as AnyQuery)("projects")
      .select("id, name, status, client_id, contract_value, health_score")
      .eq("id", projectId)
      .eq("studio_id", studioId)
      .single(),

    // Overdue tasks
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .lt("due_date", new Date().toISOString().split("T")[0])
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(20),

    // Pending RFIs
    supabase
      .from("rfis")
      .select("id, title, created_at")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(10),

    // Pending procurement items via item status
    (supabase.from as AnyQuery)("procurement_item_status")
      .select("id, item_id, client_approval_status")
      .eq("studio_id", studioId)
      .eq("client_approval_status", "pending")
      .limit(20),

    // Outstanding invoices (column is "total" per types)
    supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, status")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(10),

    // Recent site updates (column is "status_note" per types)
    supabase
      .from("site_updates")
      .select("id, status_note, submitted_at")
      .eq("project_id", projectId)
      .eq("studio_id", studioId)
      .order("submitted_at", { ascending: false })
      .limit(5),

    // Team members
    supabase
      .from("users")
      .select("id, name, role")
      .eq("studio_id", studioId)
      .limit(30),
  ])

  const project = projectResult.data
  if (!project) throw new Error("Project not found")

  // Fetch client name
  let clientName = "Unknown"
  if (project.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", project.client_id)
      .single()
    if (client) clientName = client.name
  }

  // Fetch assignees for overdue tasks
  const overdueTasks = overdueTasksResult.data ?? []
  const overdueTaskIds = overdueTasks.map((t: { id: string }) => t.id)
  const assigneeMap = new Map<string, string>()
  if (overdueTaskIds.length > 0) {
    const { data: assignees } = await supabase
      .from("task_assignees")
      .select("task_id, user:users(name)")
      .in("task_id", overdueTaskIds)
      .eq("studio_id", studioId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignees?.forEach((a: any) => {
      if (a.user?.name && !assigneeMap.has(a.task_id)) {
        assigneeMap.set(a.task_id, a.user.name)
      }
    })
  }

  // Fetch procurement item details
  const procItems = procurementResult.data ?? []
  const itemIds = procItems.map((p: { item_id: string }) => p.item_id).filter(Boolean)
  const procDetailMap = new Map<string, { item_name: string; schedule_name: string }>()
  if (itemIds.length > 0) {
    // column is "name" in procurement_items types
    const { data: procDetails } = await supabase
      .from("procurement_items")
      .select("id, name, schedule_id")
      .in("id", itemIds)
      .eq("studio_id", studioId)
    const scheduleIds = (procDetails ?? []).map((d: { schedule_id: string }) => d.schedule_id).filter(Boolean)
    const scheduleNameMap = new Map<string, string>()
    if (scheduleIds.length > 0) {
      const { data: schedules } = await supabase
        .from("procurement_schedules")
        .select("id, name")
        .in("id", scheduleIds)
        .eq("studio_id", studioId)
      schedules?.forEach((s: { id: string; name: string }) => scheduleNameMap.set(s.id, s.name))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    procDetails?.forEach((d: any) => {
      procDetailMap.set(d.id, { item_name: d.name, schedule_name: scheduleNameMap.get(d.schedule_id) ?? "" })
    })
  }

  const now = Date.now()

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status ?? "active",
      client_name: clientName,
      contract_value: project.contract_value ?? null,
      health_score: project.health_score ?? "green",
    },
    overdue_tasks: overdueTasks.map((t: { id: string; title: string; due_date: string | null }) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date ?? "",
      assigned_to: assigneeMap.get(t.id) ?? null,
    })),
    pending_rfis: (rfisResult.data ?? []).map((r: { id: string; title: string; created_at: string }) => ({
      id: r.id,
      title: r.title,
      days_open: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
    })),
    pending_procurement: procItems.map((p: { id: string; item_id: string; client_approval_status: string }) => ({
      id: p.id,
      item_name: procDetailMap.get(p.item_id)?.item_name ?? "Unknown item",
      schedule_name: procDetailMap.get(p.item_id)?.schedule_name ?? "",
      status: p.client_approval_status,
    })),
    outstanding_invoices: (invoicesResult.data ?? []).map((inv: { id: string; invoice_number: string; total: number; due_date: string | null; status: string }) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      total: inv.total,
      days_overdue: inv.due_date
        ? Math.max(0, Math.floor((now - new Date(inv.due_date).getTime()) / 86400000))
        : 0,
    })),
    recent_site_updates: (siteUpdatesResult.data ?? []).map((u: { id: string; status_note: string | null; submitted_at: string }) => ({
      id: u.id,
      note: u.status_note ?? "",
      submitted_at: u.submitted_at,
    })),
    team_members: (teamResult.data ?? []).map((u: { id: string; name: string; role: string }) => ({
      id: u.id,
      name: u.name,
      role: u.role,
    })),
  }
}

// ─── getOrCreateConversation ──────────────────────────────────────────────────

export async function getOrCreateConversation(projectId: string | null): Promise<string> {
  const { supabase, userId, studioId } = await getAuthContext()
  // ai_conversations is not in types yet — cast as any
  const from = supabase.from as AnyQuery

  const baseQuery = from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("studio_id", studioId)

  const { data: existing } = await (projectId
    ? baseQuery.eq("project_id", projectId).maybeSingle()
    : baseQuery.is("project_id", null).maybeSingle())

  if (existing?.id) return existing.id

  const { data: created, error } = await from("ai_conversations")
    .insert({ studio_id: studioId, user_id: userId, project_id: projectId ?? null, messages: [] })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return created.id
}

// ─── getConversationHistory ───────────────────────────────────────────────────

export async function getConversationHistory(conversationId: string): Promise<AIMessage[]> {
  const { supabase, studioId } = await getAuthContext()
  const from = supabase.from as AnyQuery

  const { data, error } = await from("ai_conversations")
    .select("messages, studio_id")
    .eq("id", conversationId)
    .single()

  if (error || !data) return []
  if (data.studio_id !== studioId) throw new Error("Forbidden")

  return (data.messages ?? []) as AIMessage[]
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

export async function sendMessage(input: {
  conversationId: string
  projectId: string | null
  userMessage: string
}): Promise<AIMessage> {
  const { supabase, studioId, userId } = await getAuthContext()
  const from = supabase.from as AnyQuery

  // Verify conversation belongs to auth studio
  const { data: conv } = await from("ai_conversations")
    .select("messages, studio_id")
    .eq("id", input.conversationId)
    .single()

  if (!conv || conv.studio_id !== studioId) throw new Error("Forbidden")

  // Fetch studio name + user name + project context in parallel
  const [studioResult, userResult, context] = await Promise.all([
    supabase.from("studios").select("name").eq("id", studioId).single(),
    supabase.from("users").select("name").eq("id", userId).single(),
    input.projectId ? getProjectContext(input.projectId) : Promise.resolve(null),
  ])

  const studioName = studioResult.data?.name ?? "Studio"
  const userName = userResult.data?.name ?? "Team Member"
  const systemPrompt = buildSystemPrompt(context, studioName, userName)

  // Build messages for Claude (last 20 max)
  const history = ((conv.messages ?? []) as AIMessage[]).slice(-20)
  const claudeMessages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: input.userMessage },
  ]

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Claude API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const rawText: string = data.content?.[0]?.text ?? ""

  // Parse action proposal from <action>...</action> tags
  const actionMatch = rawText.match(/<action>([\s\S]*?)<\/action>/)
  let actionProposal: ActionProposal | undefined
  let visibleContent = rawText

  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1])
      actionProposal = { ...parsed, status: "pending" } as ActionProposal
    } catch {
      // malformed action block — ignore
    }
    visibleContent = rawText.replace(/<action>[\s\S]*?<\/action>/, "").trim()
  }

  const now = new Date().toISOString()
  const userMsg: AIMessage = { role: "user", content: input.userMessage, timestamp: now }
  const assistantMsg: AIMessage = {
    role: "assistant",
    content: visibleContent,
    timestamp: new Date(Date.now() + 1).toISOString(),
    ...(actionProposal ? { action_proposal: actionProposal } : {}),
  }

  // Persist both messages
  const updatedMessages = [...((conv.messages ?? []) as AIMessage[]), userMsg, assistantMsg]
  await from("ai_conversations")
    .update({ messages: updatedMessages })
    .eq("id", input.conversationId)

  return assistantMsg
}

// ─── confirmAction ────────────────────────────────────────────────────────────

export async function confirmAction(
  conversationId: string,
  messageTimestamp: string,
  action: ActionProposal
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const from = supabase.from as AnyQuery

  const { data: conv } = await from("ai_conversations")
    .select("messages, studio_id, project_id")
    .eq("id", conversationId)
    .single()

  if (!conv || conv.studio_id !== studioId) throw new Error("Forbidden")

  // Execute the action
  switch (action.type) {
    case "create_task": {
      const p = action.payload as CreateTaskPayload
      await createTask({
        project_id: p.project_id,
        title: p.title,
        description: p.description ?? undefined,
        priority: p.priority,
        due_date: p.due_date ?? undefined,
      })
      revalidatePath(`/dashboard/projects/${p.project_id}/tasks`)
      break
    }
    case "send_whatsapp": {
      const p = action.payload as SendWhatsAppPayload
      await sendWhatsAppMessage({
        to: p.recipient_phone,
        templateName: "custom_message",
        variables: { message: p.message_text },
        studioId,
        recipientType: "client",
        recipientId: p.project_id,
        projectId: p.project_id,
      })
      break
    }
    case "update_task_status": {
      const p = action.payload as UpdateTaskStatusPayload
      await updateTask(p.task_id, { status: p.new_status })
      if (conv.project_id) revalidatePath(`/dashboard/projects/${conv.project_id}/tasks`)
      break
    }
    case "create_meeting_note": {
      const p = action.payload as CreateMeetingNotePayload
      await createMeeting({
        projectId: p.project_id,
        title: p.title,
        meetingType: "other",
        meetingDate: new Date().toISOString().split("T")[0],
        attendees: p.attendees.map((name) => ({
          type: "external" as const,
          user_id: null,
          name,
          role: "",
        })),
      })
      revalidatePath(`/dashboard/projects/${p.project_id}/meetings`)
      break
    }
  }

  // Update status in messages JSONB
  const messages = (conv.messages ?? []) as AIMessage[]
  const updated = messages.map((m) => {
    if (m.timestamp === messageTimestamp && m.action_proposal) {
      return { ...m, action_proposal: { ...m.action_proposal, status: "confirmed" as const } }
    }
    return m
  })

  await from("ai_conversations")
    .update({ messages: updated })
    .eq("id", conversationId)
}

// ─── dismissAction ────────────────────────────────────────────────────────────

export async function dismissAction(conversationId: string, messageTimestamp: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const from = supabase.from as AnyQuery

  const { data: conv } = await from("ai_conversations")
    .select("messages, studio_id")
    .eq("id", conversationId)
    .single()

  if (!conv || conv.studio_id !== studioId) throw new Error("Forbidden")

  const messages = (conv.messages ?? []) as AIMessage[]
  const updated = messages.map((m) => {
    if (m.timestamp === messageTimestamp && m.action_proposal) {
      return { ...m, action_proposal: { ...m.action_proposal, status: "dismissed" as const } }
    }
    return m
  })

  await from("ai_conversations")
    .update({ messages: updated })
    .eq("id", conversationId)
}

// ─── clearConversation ────────────────────────────────────────────────────────

export async function clearConversation(conversationId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()
  const from = supabase.from as AnyQuery

  const { data: conv } = await from("ai_conversations")
    .select("studio_id")
    .eq("id", conversationId)
    .single()

  if (!conv || conv.studio_id !== studioId) throw new Error("Forbidden")

  await from("ai_conversations")
    .update({ messages: [] })
    .eq("id", conversationId)
}
