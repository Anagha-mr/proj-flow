"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createMeeting, updateMeeting } from "@/app/actions/meetings"
import type { Meeting, MeetingAttendee } from "@/app/actions/meetings"

interface StudioUser { id: string; name: string; role: string }

interface LogMeetingSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  studioUsers: StudioUser[]
  currentUser: { id: string; name: string; role: string }
  editMeeting?: Meeting | null
  onCreated?: (m: Meeting) => void
  onUpdated?: (m: Meeting) => void
}

const MEETING_TYPES = [
  { value: "site_visit",          label: "Site Visit" },
  { value: "design_review",       label: "Design Review" },
  { value: "client_presentation", label: "Client Presentation" },
  { value: "contractor_briefing", label: "Contractor Briefing" },
  { value: "internal",            label: "Internal" },
  { value: "other",               label: "Other" },
] as const

export function LogMeetingSheet({
  open, onOpenChange, projectId, studioUsers, currentUser, editMeeting, onCreated, onUpdated,
}: LogMeetingSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState(editMeeting?.title ?? "")
  const [meetingType, setMeetingType] = useState<Meeting['meeting_type']>(editMeeting?.meeting_type ?? "site_visit")
  const [meetingDate, setMeetingDate] = useState(editMeeting?.meeting_date ?? "")
  const [startTime, setStartTime] = useState(editMeeting?.start_time ?? "")
  const [endTime, setEndTime] = useState(editMeeting?.end_time ?? "")
  const [location, setLocation] = useState(editMeeting?.location ?? "")
  const [agenda, setAgenda] = useState(editMeeting?.agenda ?? "")
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(editMeeting?.attendees ?? [])
  const [externalName, setExternalName] = useState("")
  const [externalRole, setExternalRole] = useState("")

  function addInternalAttendee(userId: string) {
    const user = studioUsers.find((u) => u.id === userId)
    if (!user) return
    if (attendees.some((a) => a.user_id === userId)) return
    setAttendees((prev) => [...prev, { type: "internal", user_id: userId, name: user.name, role: user.role }])
  }

  function addExternalAttendee() {
    if (!externalName.trim()) return
    setAttendees((prev) => [...prev, { type: "external", user_id: null, name: externalName.trim(), role: externalRole.trim() || "Guest" }])
    setExternalName("")
    setExternalRole("")
  }

  function removeAttendee(idx: number) {
    setAttendees((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!title.trim() || !meetingDate) {
      toast({ title: "Title and date are required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editMeeting) {
        const updated = await updateMeeting(editMeeting.id, {
          title: title.trim(),
          meetingType,
          meetingDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          location: location || undefined,
          attendees,
          agenda: agenda || undefined,
        })
        onUpdated?.(updated)
        toast({ title: "Meeting updated" })
      } else {
        const created = await createMeeting({
          projectId,
          title: title.trim(),
          meetingType,
          meetingDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          location: location || undefined,
          attendees,
          agenda: agenda || undefined,
        })
        onCreated?.(created)
        toast({ title: "Meeting logged" })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const usersNotAdded = studioUsers.filter((u) => !attendees.some((a) => a.user_id === u.id))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{editMeeting ? "Edit Meeting" : "Log Meeting"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Meeting Type *</label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as Meeting['meeting_type'])}>
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Date *</label>
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="focus-visible:ring-[#e94560]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Start Time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="focus-visible:ring-[#e94560]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">End Time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="focus-visible:ring-[#e94560]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue or link" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Attendees</label>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attendees.map((a, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {a.name} {a.type === "external" && <span className="text-muted-foreground">(ext)</span>}
                    <button onClick={() => removeAttendee(i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            {usersNotAdded.length > 0 && (
              <Select onValueChange={addInternalAttendee} value="">
                <SelectTrigger className="focus:ring-[#e94560]">
                  <SelectValue placeholder="Add team member…" />
                </SelectTrigger>
                <SelectContent>
                  {usersNotAdded.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 mt-2">
              <Input value={externalName} onChange={(e) => setExternalName(e.target.value)} placeholder="External name" className="flex-1 focus-visible:ring-[#e94560]" />
              <Input value={externalRole} onChange={(e) => setExternalRole(e.target.value)} placeholder="Role" className="w-28 focus-visible:ring-[#e94560]" />
              <Button type="button" variant="outline" size="sm" onClick={addExternalAttendee} disabled={!externalName.trim()}>Add</Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Agenda</label>
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Key topics to discuss…" rows={4} className="focus-visible:ring-[#e94560]" />
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#e94560] hover:bg-[#d63850] text-white">
            {saving ? "Saving…" : editMeeting ? "Save Changes" : "Save Meeting"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
