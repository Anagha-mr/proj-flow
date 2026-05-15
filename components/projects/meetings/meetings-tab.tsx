"use client"

import { useState, useEffect } from "react"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/PermissionGate"
import { MeetingCard } from "./meeting-card"
import { LogMeetingSheet } from "./log-meeting-sheet"
import { MeetingDetailSheet } from "./meeting-detail-sheet"
import { deleteMeeting } from "@/app/actions/meetings"
import { checkAndEscalateRfis } from "@/app/actions/rfis"
import { useToast } from "@/hooks/use-toast"
import type { Meeting } from "@/app/actions/meetings"

type MeetingTypeFilter = 'all' | Meeting['meeting_type']

interface StudioUser { id: string; name: string; role: string }

interface MeetingsTabProps {
  project: { id: string; studio_id: string; name: string }
  initialMeetings: Meeting[]
  currentUser: { id: string; name: string; role: string }
  studioUsers: StudioUser[]
}

const TYPE_FILTERS: { value: MeetingTypeFilter; label: string }[] = [
  { value: "all",                  label: "All" },
  { value: "site_visit",           label: "Site Visit" },
  { value: "design_review",        label: "Design Review" },
  { value: "client_presentation",  label: "Client Presentation" },
  { value: "contractor_briefing",  label: "Contractor Briefing" },
  { value: "internal",             label: "Internal" },
]

const SKELETON_COUNT = 3

export function MeetingsTab({ project, initialMeetings, currentUser, studioUsers }: MeetingsTabProps) {
  const { toast } = useToast()
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings)
  const [typeFilter, setTypeFilter] = useState<MeetingTypeFilter>("all")
  const [logOpen, setLogOpen] = useState(false)
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null)
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null)
  const [loaded] = useState(true)

  // Fire-and-forget RFI escalation check on mount
  useEffect(() => {
    checkAndEscalateRfis(project.id).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const filtered = meetings.filter((m) =>
    typeFilter === "all" || m.meeting_type === typeFilter
  )

  async function handleDelete(meetingId: string) {
    try {
      await deleteMeeting(meetingId)
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
      toast({ title: "Meeting deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <PermissionGate action="manage_meetings">
          <Button
            size="sm"
            onClick={() => { setEditMeeting(null); setLogOpen(true) }}
            className="bg-[#e94560] hover:bg-[#d63850] text-white gap-1.5"
          >
            + Log Meeting
          </Button>
        </PermissionGate>

        <div className="flex gap-1.5 flex-wrap ml-auto">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-[#1a1a2e] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {!loaded ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-gray-700">
              {meetings.length === 0 ? "No meetings logged yet." : "No meetings match the filter."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {meetings.length === 0 ? "Log your first meeting." : "Try a different filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => setDetailMeeting(meeting)}
              onEdit={() => { setEditMeeting(meeting); setLogOpen(true) }}
              onShare={() => setDetailMeeting(meeting)}
              onDelete={() => handleDelete(meeting.id)}
            />
          ))}
        </div>
      )}

      {/* Log / Edit sheet */}
      <LogMeetingSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        projectId={project.id}
        studioUsers={studioUsers}
        currentUser={currentUser}
        editMeeting={editMeeting}
        onCreated={(m) => setMeetings((prev) => [m, ...prev])}
        onUpdated={(m) => setMeetings((prev) => prev.map((x) => x.id === m.id ? m : x))}
      />

      {/* Detail sheet */}
      {detailMeeting && (
        <MeetingDetailSheet
          open={!!detailMeeting}
          onOpenChange={(v) => { if (!v) setDetailMeeting(null) }}
          meeting={detailMeeting}
          studioUsers={studioUsers}
          onUpdated={(m) => {
            setMeetings((prev) => prev.map((x) => x.id === m.id ? m : x))
            setDetailMeeting(m)
          }}
        />
      )}
    </div>
  )
}
