"use server"

import { revalidatePath } from "next/cache"
import { getAuthContext } from "./_auth"
import { createServiceClient } from "@/lib/supabase/service"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AISuggestionClassification =
  | 'client_approval'
  | 'vendor_quote'
  | 'contractor_query'
  | 'invoice_query'
  | 'site_update'
  | 'general'

export type AISuggestionActionType =
  | 'update_procurement_approval'
  | 'create_quote_response'
  | 'create_task'
  | 'update_invoice_status'
  | 'log_site_update'
  | 'no_action'

export interface GmailConnection {
  id: string
  user_id: string
  gmail_address: string
  is_active: boolean
  connected_at: string
  last_sync_at: string | null
}

export interface AISuggestion {
  id: string
  studio_id: string
  user_id: string
  project_id: string | null
  source_type: string
  source_reference: string
  sender_email: string | null
  sender_name: string | null
  email_subject: string | null
  email_snippet: string | null
  classification: AISuggestionClassification
  suggested_action_type: AISuggestionActionType
  suggested_action_data: Record<string, unknown>
  status: 'pending' | 'accepted' | 'edited' | 'dismissed'
  created_at: string
  acted_at: string | null
  expires_at: string
}

// ─── getGmailConnection ───────────────────────────────────────────────────────

export async function getGmailConnection(): Promise<GmailConnection | null> {
  const { supabase, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('gmail_connections')
    .select('id, user_id, gmail_address, is_active, connected_at, last_sync_at')
    .eq('user_id', userId)
    .maybeSingle()

  return data ?? null
}

// ─── disconnectGmail ──────────────────────────────────────────────────────────

export async function disconnectGmail(): Promise<void> {
  const { supabase, userId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('gmail_connections')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('users')
    .update({ gmail_connected: false })
    .eq('id', userId)

  revalidatePath('/dashboard/settings')
}

// ─── getAISuggestions ─────────────────────────────────────────────────────────

export async function getAISuggestions(): Promise<AISuggestion[]> {
  const { supabase, studioId } = await getAuthContext()

  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('ai_suggestions')
    .select('*')
    .eq('studio_id', studioId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })

  return (data ?? []) as AISuggestion[]
}

// ─── acceptAISuggestion ───────────────────────────────────────────────────────

export async function acceptAISuggestion(suggestionId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suggestion, error: fetchError } = await (supabase.from as any)('ai_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .eq('studio_id', studioId)
    .single()

  if (fetchError || !suggestion) throw new Error('Suggestion not found')

  await dispatchSuggestionAction(supabase, studioId, suggestion, suggestion.suggested_action_data)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('ai_suggestions')
    .update({ status: 'accepted', acted_at: new Date().toISOString() })
    .eq('id', suggestionId)

  revalidatePath('/dashboard')
}

// ─── editAndAcceptAISuggestion ────────────────────────────────────────────────

export async function editAndAcceptAISuggestion(
  suggestionId: string,
  overrides: Record<string, unknown>
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suggestion, error: fetchError } = await (supabase.from as any)('ai_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .eq('studio_id', studioId)
    .single()

  if (fetchError || !suggestion) throw new Error('Suggestion not found')

  const mergedData = { ...suggestion.suggested_action_data, ...overrides }

  await dispatchSuggestionAction(supabase, studioId, suggestion, mergedData)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('ai_suggestions')
    .update({
      status: 'edited',
      acted_at: new Date().toISOString(),
      suggested_action_data: mergedData,
    })
    .eq('id', suggestionId)

  revalidatePath('/dashboard')
}

// ─── dismissAISuggestion ──────────────────────────────────────────────────────

export async function dismissAISuggestion(suggestionId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('ai_suggestions')
    .update({ status: 'dismissed', acted_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('studio_id', studioId)

  revalidatePath('/dashboard')
}

// ─── dismissAllAISuggestions ──────────────────────────────────────────────────

export async function dismissAllAISuggestions(): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from as any)('ai_suggestions')
    .update({ status: 'dismissed', acted_at: now })
    .eq('studio_id', studioId)
    .eq('status', 'pending')

  revalidatePath('/dashboard')
}

// ─── dispatchSuggestionAction (internal) ──────────────────────────────────────

async function dispatchSuggestionAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  studioId: string,
  suggestion: AISuggestion,
  actionData: Record<string, unknown>
): Promise<void> {
  const type = suggestion.suggested_action_type

  if (type === 'update_procurement_approval') {
    const itemId = actionData.item_id as string | undefined
    const newStatus = actionData.new_approval_status as string | undefined
    if (itemId && newStatus) {
      await supabase
        .from('procurement_item_status')
        .update({ client_approval_status: newStatus })
        .eq('item_id', itemId)

      if (actionData.project_id) {
        revalidatePath(`/dashboard/projects/${actionData.project_id}/procurement`)
      }
    }
  } else if (type === 'create_task') {
    const title = actionData.title as string | undefined
    const projectId = actionData.project_id as string | undefined
    if (title) {
      let dueDate: string | null = null
      if (typeof actionData.suggested_due_days === 'number') {
        const d = new Date()
        d.setDate(d.getDate() + actionData.suggested_due_days)
        dueDate = d.toISOString().split('T')[0]
      }
      await supabase.from('tasks').insert({
        studio_id: studioId,
        project_id: projectId ?? null,
        title,
        status: 'todo',
        due_date: dueDate,
        created_by_id: suggestion.user_id,
      })
    }
  } else if (type === 'create_quote_response') {
    const vendorId = actionData.vendor_id as string | undefined
    const procItemId = actionData.procurement_item_id as string | undefined
    const price = actionData.suggested_price as number | undefined
    if (vendorId && procItemId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)('quote_responses').insert({
        studio_id: studioId,
        vendor_id: vendorId,
        procurement_item_id: procItemId,
        unit_price: price ?? null,
        status: 'received',
      })
      if (actionData.project_id) {
        revalidatePath(`/dashboard/projects/${actionData.project_id}/orders`)
      }
    }
  } else if (type === 'update_invoice_status') {
    // Only creates a reminder task — human must confirm in invoice UI
    const invoiceNumber = actionData.invoice_number as string | undefined
    const clientName = actionData.client_name as string | undefined
    await supabase.from('tasks').insert({
      studio_id: studioId,
      project_id: null,
      title: `Review invoice query: ${invoiceNumber ?? ''} — ${clientName ?? ''}`,
      status: 'todo',
      created_by_id: suggestion.user_id,
    })
  }
  // log_site_update and no_action: no DB writes
}
