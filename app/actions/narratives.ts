"use server"

import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { buildNarrativePrompt } from "@/lib/utils/narrative-prompt"
import { getMonday } from "@/lib/utils/date"
import { sendWhatsAppMessage } from "./notifications"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyNarrative {
  id: string
  studio_id: string
  project_id: string
  client_id: string
  week_start_date: string
  generated_text: string
  edited_text: string | null
  final_text: string
  status: 'draft' | 'approved' | 'sent' | 'skipped' | 'failed'
  language: string
  generated_at: string
  reviewed_at: string | null
  reviewed_by_id: string | null
  sent_at: string | null
  context_snapshot: NarrativeContext | null
  created_at: string
  project?: { id: string; name: string }
  client?: { id: string; name: string; whatsapp_number: string }
}

export interface NarrativeContext {
  project_name: string
  client_name: string
  week_start: string
  week_end: string
  completed_tasks: Array<{ title: string; completed_at: string }>
  in_progress_tasks: Array<{ title: string; due_date: string | null }>
  approved_procurement: Array<{ item_name: string; vendor: string | null }>
  upcoming_milestones: Array<{ title: string; due_date: string }>
  recent_site_updates: Array<{ summary: string; submitted_at: string }>
  overdue_count: number
  health_score: string
}

// ── Helper: add days to a date string ─────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Helper: clean AI-generated text for WhatsApp ───────────────────────────────

function cleanNarrativeText(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')      // remove markdown headers
    .replace(/\*\*(.+?)\*\*/g, '$1')  // remove bold
    .replace(/\*(.+?)\*/g, '$1')      // remove italic
    .replace(/^[-•*]\s+/gm, '')       // remove bullet points
    .replace(/^\d+\.\s+/gm, '')       // remove numbered lists
    .replace(/\n{3,}/g, '\n\n')       // collapse excessive newlines
    .trim()
}

// ── getNarrativeContext ────────────────────────────────────────────────────────

export async function getNarrativeContext(
  projectId: string,
  weekStartDate: string
): Promise<NarrativeContext> {
  const { supabase, studioId } = await getAuthContext()
  return _buildNarrativeContext(supabase, studioId, projectId, weekStartDate)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _buildNarrativeContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  studioId: string,
  projectId: string,
  weekStartDate: string
): Promise<NarrativeContext> {
  const weekEndDate = addDays(weekStartDate, 6)
  const now = new Date().toISOString().split('T')[0]
  const twoWeeksOut = addDays(now, 14)

  const [
    projectResult,
    completedTasksResult,
    inProgressTasksResult,
    procItemsResult,
    upcomingMilestonesResult,
    siteUpdatesResult,
    overdueResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, health_score, client_id')
      .eq('id', projectId)
      .eq('studio_id', studioId)
      .single(),

    supabase
      .from('tasks')
      .select('title, updated_at')
      .eq('project_id', projectId)
      .eq('studio_id', studioId)
      .eq('status', 'done')
      .gte('updated_at', weekStartDate)
      .lte('updated_at', weekEndDate + 'T23:59:59Z')
      .order('updated_at', { ascending: false })
      .limit(10),

    supabase
      .from('tasks')
      .select('title, due_date')
      .eq('project_id', projectId)
      .eq('studio_id', studioId)
      .in('status', ['in_progress', 'review'])
      .order('due_date', { ascending: true })
      .limit(8),

    supabase
      .from('procurement_item_status')
      .select('item_id, client_approval_status')
      .eq('studio_id', studioId)
      .eq('client_approval_status', 'approved')
      .gte('updated_at', weekStartDate)
      .limit(8),

    supabase
      .from('tasks')
      .select('title, due_date')
      .eq('project_id', projectId)
      .eq('studio_id', studioId)
      .neq('status', 'done')
      .gte('due_date', now)
      .lte('due_date', twoWeeksOut)
      .order('due_date', { ascending: true })
      .limit(5),

    supabase
      .from('site_updates')
      .select('status_note, submitted_at')
      .eq('project_id', projectId)
      .eq('studio_id', studioId)
      .gte('submitted_at', weekStartDate)
      .order('submitted_at', { ascending: false })
      .limit(3),

    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('studio_id', studioId)
      .neq('status', 'done')
      .lt('due_date', now),
  ])

  const project = projectResult.data
  if (!project) throw new Error('Project not found')

  // Fetch client
  let clientName = 'Client'
  let clientWhatsApp = ''
  if (project.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('name, whatsapp_number')
      .eq('id', project.client_id)
      .single()
    if (client) {
      clientName = client.name
      clientWhatsApp = client.whatsapp_number ?? ''
    }
  }

  // Fetch procurement item names for approved items
  const procItems = procItemsResult.data ?? []
  const itemIds = procItems.map((p: { item_id: string }) => p.item_id).filter(Boolean)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let approvedProcurement: Array<{ item_name: string; vendor: string | null }> = []
  if (itemIds.length > 0) {
    const { data: itemDetails } = await supabase
      .from('procurement_items')
      .select('id, name')
      .in('id', itemIds)
      .eq('studio_id', studioId)
    approvedProcurement = (itemDetails ?? []).map((d: { id: string; name: string }) => ({
      item_name: d.name,
      vendor: null,
    }))
  }

  return {
    project_name: project.name,
    client_name: clientName,
    week_start: weekStartDate,
    week_end: weekEndDate,
    completed_tasks: (completedTasksResult.data ?? []).map((t: { title: string; updated_at: string }) => ({
      title: t.title,
      completed_at: t.updated_at,
    })),
    in_progress_tasks: (inProgressTasksResult.data ?? []).map((t: { title: string; due_date: string | null }) => ({
      title: t.title,
      due_date: t.due_date,
    })),
    approved_procurement: approvedProcurement,
    upcoming_milestones: (upcomingMilestonesResult.data ?? []).map((t: { title: string; due_date: string }) => ({
      title: t.title,
      due_date: t.due_date,
    })),
    recent_site_updates: (siteUpdatesResult.data ?? []).map((u: { status_note: string; submitted_at: string }) => ({
      summary: u.status_note ?? '',
      submitted_at: u.submitted_at,
    })),
    overdue_count: overdueResult.count ?? 0,
    health_score: project.health_score ?? 'unknown',
    // Attach for sendNarrative use (not part of the returned context but helps internally)
    _client_whatsapp: clientWhatsApp,
  } as NarrativeContext & { _client_whatsapp: string }
}

// ── generateNarrativeDraft ─────────────────────────────────────────────────────

export async function generateNarrativeDraft(
  projectId: string,
  weekStartDate: string,
  language?: string
): Promise<WeeklyNarrative> {
  const { supabase, studioId, userId } = await getAuthContext()

  // Verify project belongs to this studio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase.from as any)('projects')
    .select('id, narrative_language, client_id')
    .eq('id', projectId)
    .eq('studio_id', studioId)
    .single() as { data: { id: string; narrative_language: string | null; client_id: string | null } | null }

  if (!project) throw new Error('Project not found')

  // Check for existing narrative
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)('weekly_narratives')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()

  if (existing && (existing.status === 'sent' || existing.status === 'approved')) {
    throw new Error('Narrative already processed for this week')
  }

  // Determine language — fetch client preferred_language separately
  let clientLang: string | null = null
  if (project.client_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientRow } = await (supabase.from as any)('clients')
      .select('preferred_language')
      .eq('id', project.client_id)
      .single() as { data: { preferred_language: string | null } | null }
    clientLang = clientRow?.preferred_language ?? null
  }
  const resolvedLang = language ?? project.narrative_language ?? clientLang ?? 'en'

  // Build context
  const context = await _buildNarrativeContext(supabase, studioId, projectId, weekStartDate)
  const clientId = project.client_id

  // Generate via Groq
  const systemPrompt = buildNarrativePrompt(resolvedLang)

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(context) },
      ],
    }),
  })

  if (!groqResponse.ok) {
    const err = await groqResponse.text()
    throw new Error(`Groq API error: ${groqResponse.status} ${err}`)
  }

  const groqData = await groqResponse.json()
  const rawText: string = groqData.choices?.[0]?.message?.content ?? ''
  const generatedText = cleanNarrativeText(rawText)

  // Upsert narrative (never insert final_text — it's a generated column)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: narrative, error } = await (supabase.from as any)('weekly_narratives')
    .upsert(
      {
        studio_id: studioId,
        project_id: projectId,
        client_id: clientId,
        week_start_date: weekStartDate,
        generated_text: generatedText,
        edited_text: null,
        language: resolvedLang,
        status: 'draft',
        context_snapshot: context as unknown as Record<string, unknown>,
        generated_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by_id: null,
        sent_at: null,
      },
      { onConflict: 'project_id,week_start_date' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  void userId // referenced in approveNarrative — suppress lint

  revalidatePath('/dashboard')

  return {
    ...narrative,
    project: { id: projectId, name: context.project_name },
    client: { id: clientId ?? '', name: context.client_name, whatsapp_number: '' },
  } as WeeklyNarrative
}

// ── approveNarrative ──────────────────────────────────────────────────────────

export async function approveNarrative(narrativeId: string): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)('weekly_narratives')
    .select('id, status, studio_id')
    .eq('id', narrativeId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error('Narrative not found')
  if (existing.status !== 'draft') throw new Error('Narrative is not in draft status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('weekly_narratives')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by_id: userId,
    })
    .eq('id', narrativeId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

// ── editAndApproveNarrative ───────────────────────────────────────────────────

export async function editAndApproveNarrative(
  narrativeId: string,
  editedText: string
): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  if (!editedText.trim()) throw new Error('Edited text cannot be empty')
  if (editedText.length > 1000) throw new Error('Edited text must be under 1000 characters')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)('weekly_narratives')
    .select('id, status, studio_id')
    .eq('id', narrativeId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error('Narrative not found')
  if (existing.status !== 'draft') throw new Error('Narrative is not in draft status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('weekly_narratives')
    .update({
      edited_text: editedText.trim(),
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by_id: userId,
    })
    .eq('id', narrativeId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

// ── skipNarrative ─────────────────────────────────────────────────────────────

export async function skipNarrative(narrativeId: string): Promise<void> {
  const { supabase, studioId, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from as any)('weekly_narratives')
    .select('id, studio_id')
    .eq('id', narrativeId)
    .single()

  if (!existing || existing.studio_id !== studioId) throw new Error('Narrative not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('weekly_narratives')
    .update({
      status: 'skipped',
      reviewed_at: new Date().toISOString(),
      reviewed_by_id: userId,
    })
    .eq('id', narrativeId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

// ── sendNarrative ─────────────────────────────────────────────────────────────

export async function sendNarrative(narrativeId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: narrative } = await (supabase.from as any)('weekly_narratives')
    .select('id, status, studio_id, project_id, client_id, final_text')
    .eq('id', narrativeId)
    .single()

  if (!narrative || narrative.studio_id !== studioId) throw new Error('Narrative not found')
  if (narrative.status !== 'approved') throw new Error('Narrative must be approved before sending')

  // Fetch client phone number
  const { data: client } = await supabase
    .from('clients')
    .select('name, whatsapp_number')
    .eq('id', narrative.client_id)
    .single()

  if (!client?.whatsapp_number) throw new Error('Client has no WhatsApp number')

  // Fetch project name
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', narrative.project_id)
    .single()

  await sendWhatsAppMessage({
    to: client.whatsapp_number,
    templateName: 'weekly_project_update',
    variables: {
      client_name: client.name,
      project_name: project?.name ?? '',
      update_text: narrative.final_text,
    },
    studioId,
    recipientType: 'client',
    recipientId: narrative.client_id,
    projectId: narrative.project_id,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('weekly_narratives')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', narrativeId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

// ── getPendingNarratives ──────────────────────────────────────────────────────

export async function getPendingNarratives(): Promise<WeeklyNarrative[]> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: narratives, error } = await (supabase.from as any)('weekly_narratives')
    .select('*')
    .eq('studio_id', studioId)
    .eq('status', 'draft')
    .order('generated_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!narratives?.length) return []

  const projectIds = [...new Set(narratives.map((n: WeeklyNarrative) => n.project_id))] as string[]
  const clientIds = [...new Set(narratives.map((n: WeeklyNarrative) => n.client_id))] as string[]

  const [projectsResult, clientsResult] = await Promise.all([
    supabase.from('projects').select('id, name').in('id', projectIds),
    supabase.from('clients').select('id, name, whatsapp_number').in('id', clientIds),
  ])

  const projectMap = new Map((projectsResult.data ?? []).map((p: { id: string; name: string }) => [p.id, p]))
  const clientMap = new Map((clientsResult.data ?? []).map((c: { id: string; name: string; whatsapp_number: string | null }) => [c.id, c]))

  return narratives.map((n: WeeklyNarrative) => ({
    ...n,
    project: projectMap.get(n.project_id),
    client: clientMap.get(n.client_id),
  }))
}

// ── getNarrativeHistory ───────────────────────────────────────────────────────

export async function getNarrativeHistory(projectId: string): Promise<WeeklyNarrative[]> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('weekly_narratives')
    .select('id, week_start_date, status, sent_at, final_text')
    .eq('project_id', projectId)
    .eq('studio_id', studioId)
    .order('week_start_date', { ascending: false })
    .limit(12)

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── getAllNarratives ──────────────────────────────────────────────────────────

export async function getAllNarratives(): Promise<WeeklyNarrative[]> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: narratives, error } = await (supabase.from as any)('weekly_narratives')
    .select('*')
    .eq('studio_id', studioId)
    .order('week_start_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!narratives?.length) return []

  const projectIds = [...new Set(narratives.map((n: WeeklyNarrative) => n.project_id))] as string[]
  const clientIds = [...new Set(narratives.map((n: WeeklyNarrative) => n.client_id))] as string[]

  const [projectsResult, clientsResult] = await Promise.all([
    supabase.from('projects').select('id, name').in('id', projectIds),
    supabase.from('clients').select('id, name, whatsapp_number').in('id', clientIds),
  ])

  const projectMap = new Map((projectsResult.data ?? []).map((p: { id: string; name: string }) => [p.id, p]))
  const clientMap = new Map((clientsResult.data ?? []).map((c: { id: string; name: string; whatsapp_number: string | null }) => [c.id, c]))

  return narratives.map((n: WeeklyNarrative) => ({
    ...n,
    project: projectMap.get(n.project_id),
    client: clientMap.get(n.client_id),
  }))
}

// ── generateAllNarratives ─────────────────────────────────────────────────────

export async function generateAllNarratives(): Promise<void> {
  const { supabase, studioId, role } = await getAuthContext()

  if (role !== 'owner' && role !== 'senior_designer') {
    throw new Error('Insufficient permissions')
  }

  const weekStartDate = getMonday(new Date())

  const { data: projects } = await supabase
    .from('projects')
    .select('id, narrative_language, client_id')
    .eq('studio_id', studioId)
    .in('status', ['active', 'in_progress'])
    .not('client_id', 'is', null)

  if (!projects?.length) return

  // Filter out projects with columns not in types — cast as needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProjects = projects as any[]

  for (const project of allProjects) {
    // Skip paused
    if (project.narrative_frequency === 'paused') continue

    // Check if narrative already exists this week
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from as any)('weekly_narratives')
      .select('id')
      .eq('project_id', project.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()

    if (existing) continue

    try {
      await generateNarrativeDraft(project.id, weekStartDate)
    } catch (err) {
      console.error(`Failed to generate narrative for project ${project.id}:`, err)
    }
  }

  revalidatePath('/dashboard')
}

// ── generateNarrativeDraftForCron (service-role variant) ──────────────────────

export async function generateNarrativeDraftForCron(
  projectId: string,
  studioId: string,
  weekStartDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
): Promise<void> {
  // Fetch project + language preferences
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, narrative_language, client_id')
    .eq('id', projectId)
    .single()

  if (!project || !project.client_id) return

  // Fetch client preferred_language
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('preferred_language')
    .eq('id', project.client_id)
    .single()

  const resolvedLang = project.narrative_language ?? client?.preferred_language ?? 'en'

  // Build context
  const context = await _buildNarrativeContext(supabaseAdmin, studioId, projectId, weekStartDate)

  // Generate via Groq
  const systemPrompt = buildNarrativePrompt(resolvedLang)

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(context) },
      ],
    }),
  })

  if (!groqResponse.ok) {
    const err = await groqResponse.text()
    throw new Error(`Groq API error: ${groqResponse.status} ${err}`)
  }

  const groqData = await groqResponse.json()
  const rawText: string = groqData.choices?.[0]?.message?.content ?? ''
  const generatedText = cleanNarrativeText(rawText)

  await supabaseAdmin
    .from('weekly_narratives')
    .insert({
      studio_id: studioId,
      project_id: projectId,
      client_id: project.client_id,
      week_start_date: weekStartDate,
      generated_text: generatedText,
      language: resolvedLang,
      status: 'draft',
      context_snapshot: context as unknown as Record<string, unknown>,
      generated_at: new Date().toISOString(),
    })
}

// ── sendNarrativeForCron (service-role variant) ────────────────────────────────

export async function sendNarrativeForCron(
  narrativeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
): Promise<void> {
  const { data: narrative } = await supabaseAdmin
    .from('weekly_narratives')
    .select('id, status, studio_id, project_id, client_id, final_text')
    .eq('id', narrativeId)
    .single()

  if (!narrative || narrative.status !== 'approved') return

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('name, whatsapp_number')
    .eq('id', narrative.client_id)
    .single()

  if (!client?.whatsapp_number) return

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('name')
    .eq('id', narrative.project_id)
    .single()

  await sendWhatsAppMessage({
    to: client.whatsapp_number,
    templateName: 'weekly_project_update',
    variables: {
      client_name: client.name,
      project_name: project?.name ?? '',
      update_text: narrative.final_text,
    },
    studioId: narrative.studio_id,
    recipientType: 'client',
    recipientId: narrative.client_id,
    projectId: narrative.project_id,
  })

  await supabaseAdmin
    .from('weekly_narratives')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', narrativeId)
}

