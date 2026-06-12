"use server"

import { getAuthContext } from "./_auth"
import { revalidatePath } from "next/cache"
import type { Json, Database } from "@/lib/supabase/types"
import { generateActionItemId } from "@/lib/utils/ids"

type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"]

export interface MeetingAttendee {
  type: 'internal' | 'external'
  user_id: string | null
  name: string
  role: string
}

export interface ActionItem {
  id: string
  description: string
  assigned_to_name: string
  assigned_to_id: string | null
  due_date: string | null
  converted_to_task_id: string | null
  status: 'open' | 'done'
}

export interface Meeting {
  id: string
  studio_id: string
  project_id: string
  title: string
  meeting_type: 'site_visit' | 'design_review' | 'client_presentation' | 'contractor_briefing' | 'internal' | 'other'
  meeting_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  attendees: MeetingAttendee[]
  agenda: string | null
  minutes: string | null
  action_items: ActionItem[]
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export async function getMeetings(projectId: string): Promise<Meeting[]> {
  const { supabase, studioId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", studioId)
    .order("meeting_date", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Meeting[]
}

export async function createMeeting(input: {
  projectId: string
  title: string
  meetingType: Meeting['meeting_type']
  meetingDate: string
  startTime?: string
  endTime?: string
  location?: string
  attendees?: MeetingAttendee[]
  agenda?: string
}): Promise<Meeting> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("studio_id", studioId)
    .single()
  if (!project) throw new Error("Project not found")

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      studio_id: studioId,
      project_id: input.projectId,
      title: input.title,
      meeting_type: input.meetingType,
      meeting_date: input.meetingDate,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      location: input.location ?? null,
      attendees: (input.attendees ?? []) as unknown as Json,
      agenda: input.agenda ?? null,
      minutes: null,
      action_items: [] as unknown as Json,
      created_by_id: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${input.projectId}`)

  // Fire-and-forget calendar push
  import("./calendar").then(({ pushToGoogleCalendar }) =>
    pushToGoogleCalendar("meeting", data.id).catch(() => {})
  ).catch(() => {})

  return data as unknown as Meeting
}

export async function updateMeeting(
  meetingId: string,
  updates: {
    title?: string
    meetingType?: Meeting['meeting_type']
    meetingDate?: string
    startTime?: string
    endTime?: string
    location?: string
    attendees?: MeetingAttendee[]
    agenda?: string
    minutes?: string
    actionItems?: ActionItem[]
  }
): Promise<Meeting> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("meetings")
    .select("project_id, studio_id")
    .eq("id", meetingId)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Meeting not found")

  const payload: MeetingUpdate = {}

  if (updates.title !== undefined) payload.title = updates.title
  if (updates.meetingType !== undefined) payload.meeting_type = updates.meetingType
  if (updates.meetingDate !== undefined) payload.meeting_date = updates.meetingDate
  if (updates.startTime !== undefined) payload.start_time = updates.startTime
  if (updates.endTime !== undefined) payload.end_time = updates.endTime
  if (updates.location !== undefined) payload.location = updates.location
  if (updates.attendees !== undefined) payload.attendees = updates.attendees as unknown as Json
  if (updates.agenda !== undefined) payload.agenda = updates.agenda
  if (updates.minutes !== undefined) payload.minutes = updates.minutes
  if (updates.actionItems !== undefined) payload.action_items = updates.actionItems as unknown as Json

  const { data, error } = await supabase
    .from("meetings")
    .update(payload)
    .eq("id", meetingId)
    .eq("studio_id", studioId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/projects/${existing.project_id}`)

  // Fire-and-forget calendar update
  import("./calendar").then(({ pushToGoogleCalendar }) =>
    pushToGoogleCalendar("meeting", meetingId).catch(() => {})
  ).catch(() => {})

  return data as unknown as Meeting
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: existing } = await supabase
    .from("meetings")
    .select("project_id, studio_id")
    .eq("id", meetingId)
    .single()
  if (!existing || existing.studio_id !== studioId) throw new Error("Meeting not found")

  await supabase.from("meetings").delete().eq("id", meetingId).eq("studio_id", studioId)

  // Fire-and-forget calendar event removal
  import("./calendar").then(({ removeFromGoogleCalendar }) =>
    removeFromGoogleCalendar("meeting", meetingId).catch(() => {})
  ).catch(() => {})

  revalidatePath(`/dashboard/projects/${existing.project_id}`)
}

export async function convertActionItemToTask(
  meetingId: string,
  actionItemId: string
): Promise<{ taskId: string }> {
  const { supabase, studioId, userId } = await getAuthContext()

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("studio_id", studioId)
    .single()
  if (!meeting) throw new Error("Meeting not found")

  const actionItems = (meeting.action_items as unknown as ActionItem[]) ?? []
  const item = actionItems.find((a) => a.id === actionItemId)
  if (!item) throw new Error("Action item not found")
  if (item.converted_to_task_id) return { taskId: item.converted_to_task_id }

  const { data: newTask, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: item.description,
      project_id: meeting.project_id,
      studio_id: studioId,
      status: "todo",
      due_date: item.due_date ?? null,
      created_by: userId,
    })
    .select("id")
    .single()

  if (taskError) throw new Error(taskError.message)

  const updatedItems = actionItems.map((a) =>
    a.id === actionItemId ? { ...a, converted_to_task_id: newTask.id } : a
  )

  const { error: updateError } = await supabase
    .from("meetings")
    .update({ action_items: updatedItems as unknown as Json })
    .eq("id", meetingId)
    .eq("studio_id", studioId)

  if (updateError) throw new Error(updateError.message)
  revalidatePath(`/dashboard/projects/${meeting.project_id}`)
  return { taskId: newTask.id }
}

export async function shareMeetingNotes(
  meetingId: string,
  recipientType: 'whatsapp' | 'email'
): Promise<void> {
  const { supabase, studioId } = await getAuthContext()

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("studio_id", studioId)
    .single()
  if (!meeting) throw new Error("Meeting not found")

  if (recipientType === 'email') {
    console.log('EMAIL: meeting notes shared for', meetingId)
    revalidatePath(`/dashboard/projects/${meeting.project_id}`)
    return
  }

  const attendees = (meeting.attendees as unknown as Array<{
    type: string
    user_id: string | null
    name: string
    role: string
  }>) ?? []

  const internalUserIds = attendees
    .filter((a) => a.type === 'internal' && a.user_id)
    .map((a) => a.user_id as string)

  const phones: string[] = []

  if (internalUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, whatsapp_number")
      .in("id", internalUserIds)
    ;(users ?? []).forEach((u) => {
      if (u.whatsapp_number) phones.push(u.whatsapp_number)
    })
  }

  if (phones.length > 0) {
    try {
      const { notifyMeetingNotesShared } = await import("./notifications")
      notifyMeetingNotesShared(meetingId, phones).catch(() => {})
    } catch {
      // fire-and-forget
    }
  }

  revalidatePath(`/dashboard/projects/${meeting.project_id}`)
}

