"use client"

import { useState } from "react"
import { format } from "date-fns"
import { MapPin, Clock, MoreVertical, Users, CheckSquare } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { Meeting } from "@/app/actions/meetings"

const MEETING_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  site_visit:            { label: "Site Visit",            className: "bg-orange-100 text-orange-700" },
  design_review:         { label: "Design Review",         className: "bg-purple-100 text-purple-700" },
  client_presentation:   { label: "Client Presentation",   className: "bg-blue-100 text-blue-700" },
  contractor_briefing:   { label: "Contractor Briefing",   className: "bg-amber-100 text-amber-700" },
  internal:              { label: "Internal",              className: "bg-slate-100 text-slate-700" },
  other:                 { label: "Other",                 className: "bg-gray-100 text-gray-600" },
}

interface MeetingCardProps {
  meeting: Meeting
  onClick: () => void
  onEdit: () => void
  onShare: () => void
  onDelete: () => void
}

export function MeetingCard({ meeting, onClick, onEdit, onShare, onDelete }: MeetingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const typeMeta = MEETING_TYPE_BADGE[meeting.meeting_type] ?? MEETING_TYPE_BADGE.other
  const date = new Date(meeting.meeting_date + "T00:00:00")
  const openItems = meeting.action_items.filter((a) => a.status === "open").length
  const totalItems = meeting.action_items.length

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return
        onClick()
      }}
    >
      <div className="flex gap-0">
        {/* Date badge */}
        <div className="flex flex-col items-center justify-center bg-[#e94560] text-white px-4 py-3 min-w-[60px]">
          <span className="text-2xl font-bold leading-none">{format(date, "dd")}</span>
          <span className="text-xs uppercase tracking-wide mt-0.5">{format(date, "MMM")}</span>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeMeta.className}`}>
                  {typeMeta.label}
                </span>
              </div>
              <p className="font-semibold text-sm text-gray-900 mt-1 truncate">{meeting.title}</p>
            </div>
            <div data-no-card-click>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={onShare}>Share Notes</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {meeting.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {meeting.location}
              </span>
            )}
            {meeting.start_time && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {meeting.start_time}{meeting.end_time ? ` – ${meeting.end_time}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
            </span>
            {totalItems > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <CheckSquare className="w-3 h-3 text-muted-foreground" />
                <span className="text-[#e94560] font-medium">{openItems} open</span>
                <span className="text-muted-foreground">· {totalItems} total</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
