"use client"

import { useState, useRef } from "react"
import { format } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { MapPin, Clock, Users, CheckCheck, ArrowRight, Mail, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateMeeting, convertActionItemToTask, shareMeetingNotes } from "@/app/actions/meetings"
import { generateActionItemId } from "@/lib/utils/ids"
import type { Meeting, ActionItem, MeetingAttendee } from "@/app/actions/meetings"

const MEETING_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  site_visit:            { label: "Site Visit",            className: "bg-orange-100 text-orange-700" },
  design_review:         { label: "Design Review",         className: "bg-purple-100 text-purple-700" },
  client_presentation:   { label: "Client Presentation",   className: "bg-blue-100 text-blue-700" },
  contractor_briefing:   { label: "Contractor Briefing",   className: "bg-amber-100 text-amber-700" },
  internal:              { label: "Internal",              className: "bg-slate-100 text-slate-700" },
  other:                 { label: "Other",                 className: "bg-gray-100 text-gray-600" },
}

interface StudioUser { id: string; name: string; role: string }

interface MeetingDetailSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  meeting: Meeting
  studioUsers: StudioUser[]
  onUpdated: (m: Meeting) => void
}

export function MeetingDetailSheet({ open, onOpenChange, meeting: initialMeeting, studioUsers, onUpdated }: MeetingDetailSheetProps) {
  const { toast } = useToast()
  const [meeting, setMeeting] = useState(initialMeeting)
  const [minutesSaved, setMinutesSaved] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // New action item form state
  const [newDesc, setNewDesc] = useState("")
  const [newAssigneeId, setNewAssigneeId] = useState("")
  const [newDueDate, setNewDueDate] = useState("")
  const minutesRef = useRef<HTMLTextAreaElement>(null)

  const typeMeta = MEETING_TYPE_BADGE[meeting.meeting_type] ?? MEETING_TYPE_BADGE.other
  const date = new Date(meeting.meeting_date + "T00:00:00")

  async function saveMinutes() {
    const minutes = minutesRef.current?.value ?? meeting.minutes ?? ""
    try {
      const updated = await updateMeeting(meeting.id, { minutes })
      setMeeting(updated)
      onUpdated(updated)
      setMinutesSaved(true)
      setTimeout(() => setMinutesSaved(false), 2000)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function toggleActionItemDone(item: ActionItem) {
    const updatedItems = meeting.action_items.map((a) =>
      a.id === item.id ? { ...a, status: a.status === "open" ? "done" : "open" } as ActionItem : a
    )
    try {
      const updated = await updateMeeting(meeting.id, { actionItems: updatedItems })
      setMeeting(updated)
      onUpdated(updated)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleConvertToTask(item: ActionItem) {
    setConvertingId(item.id)
    try {
      await convertActionItemToTask(meeting.id, item.id)
      // Refresh local state
      const updatedItems = meeting.action_items.map((a) =>
        a.id === item.id ? { ...a, converted_to_task_id: "converted" } : a
      )
      const updated = { ...meeting, action_items: updatedItems }
      setMeeting(updated)
      onUpdated(updated)
      toast({ title: "Task created from action item" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setConvertingId(null)
    }
  }

  async function handleAddActionItem() {
    if (!newDesc.trim()) return
    const assignee = studioUsers.find((u) => u.id === newAssigneeId)
    const newItem: ActionItem = {
      id: generateActionItemId(),
      description: newDesc.trim(),
      assigned_to_name: assignee?.name ?? "Unassigned",
      assigned_to_id: newAssigneeId || null,
      due_date: newDueDate || null,
      converted_to_task_id: null,
      status: "open",
    }
    const updatedItems = [...meeting.action_items, newItem]
    try {
      const updated = await updateMeeting(meeting.id, { actionItems: updatedItems })
      setMeeting(updated)
      onUpdated(updated)
      setNewDesc("")
      setNewAssigneeId("")
      setNewDueDate("")
      toast({ title: "Action item added" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleShare(type: 'whatsapp' | 'email') {
    if (type === 'email') {
      toast({ title: "Email sharing coming soon" })
      return
    }
    setSharing(true)
    try {
      await shareMeetingNotes(meeting.id, type)
      toast({ title: "Notes shared via WhatsApp" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto flex flex-col">
        <SheetHeader className="pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-lg">{meeting.title}</SheetTitle>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeMeta.className}`}>{typeMeta.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{format(date, "EEEE, d MMMM yyyy")}</p>
        </SheetHeader>

        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto">
          {/* Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <div className="flex flex-col gap-2 text-sm">
              {(meeting.start_time || meeting.end_time) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{meeting.start_time ?? ""}{meeting.end_time ? ` – ${meeting.end_time}` : ""}</span>
                </div>
              )}
              {meeting.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{meeting.location}</span>
                </div>
              )}
              {meeting.attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {meeting.attendees.map((a: MeetingAttendee, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700">
                        {a.name} <span className="text-muted-foreground">({a.role})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {meeting.agenda && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Agenda</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.agenda}</p>
                </div>
              )}
            </div>
          </section>

          {/* Minutes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Minutes</h3>
              {minutesSaved && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" /> Saved ✓
                </span>
              )}
            </div>
            <Textarea
              ref={minutesRef}
              defaultValue={meeting.minutes ?? ""}
              placeholder="Record meeting minutes here…"
              rows={6}
              onBlur={saveMinutes}
              className="focus-visible:ring-[#e94560] text-sm"
            />
          </section>

          {/* Action Items */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Action Items</h3>
            <div className="flex flex-col gap-2">
              {meeting.action_items.map((item: ActionItem) => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                  <Checkbox
                    checked={item.status === "done"}
                    onCheckedChange={() => toggleActionItemDone(item)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.status === "done" ? "line-through text-muted-foreground" : "text-gray-900"}`}>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{item.assigned_to_name}</span>
                      {item.due_date && (
                        <span className="text-xs text-muted-foreground">· Due {format(new Date(item.due_date + "T00:00:00"), "d MMM")}</span>
                      )}
                      {item.converted_to_task_id && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 gap-1">
                          <ArrowRight className="w-3 h-3" /> Task created
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!item.converted_to_task_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2 shrink-0"
                      disabled={convertingId === item.id}
                      onClick={() => handleConvertToTask(item)}
                    >
                      Convert to Task
                    </Button>
                  )}
                </div>
              ))}

              {/* Add action item */}
              <div className="p-2 rounded-lg border border-dashed border-gray-200 mt-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">+ Add action item</p>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe the action…" className="mb-2 text-sm h-8 focus-visible:ring-[#e94560]" />
                <div className="flex gap-2">
                  <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                    <SelectTrigger className="h-8 text-xs flex-1 focus:ring-[#e94560]">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {studioUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-8 text-xs w-36 focus-visible:ring-[#e94560]" />
                  <Button size="sm" className="h-8 bg-[#e94560] hover:bg-[#d63850] text-white" onClick={handleAddActionItem} disabled={!newDesc.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Share */}
          <section className="pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Share Notes</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleShare("whatsapp")} disabled={sharing} className="gap-1.5">
                <MessageCircle className="w-4 h-4" /> Share via WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleShare("email")} className="gap-1.5">
                <Mail className="w-4 h-4" /> Share via Email
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
