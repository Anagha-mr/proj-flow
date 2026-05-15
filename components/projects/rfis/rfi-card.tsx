"use client"

import { useState } from "react"
import { formatDistanceToNow, isPast, format } from "date-fns"
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { RFI } from "@/app/actions/rfis"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:         { label: "Open",         className: "bg-blue-100 text-blue-700" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-700" },
  responded:    { label: "Responded",    className: "bg-green-100 text-green-700" },
  closed:       { label: "Closed",       className: "bg-slate-100 text-slate-600" },
}

interface RfiCardProps {
  rfi: RFI
  onClick: () => void
  onRespond: () => void
  onChangeStatus: () => void
  onDelete: () => void
}

export function RfiCard({ rfi, onClick, onRespond, onChangeStatus, onDelete }: RfiCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const statusMeta = STATUS_BADGE[rfi.status] ?? STATUS_BADGE.open
  const deadline = new Date(rfi.response_deadline)
  const isOverdue = isPast(deadline) && rfi.status !== 'responded' && rfi.status !== 'closed'

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return
        onClick()
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{rfi.ref_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
          {isOverdue && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 font-semibold text-xs px-2 py-0.5 rounded">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              OVERDUE
            </span>
          )}
        </div>
        <div data-no-card-click>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(rfi.status === 'open' || rfi.status === 'under_review') && (
                <DropdownMenuItem onClick={onRespond}>Respond</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onChangeStatus}>Change Status</DropdownMenuItem>
              {rfi.status === 'open' && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="font-semibold text-sm text-gray-900 mt-2">{rfi.title}</p>

      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
        <span>Raised by: {rfi.raised_by_type === 'contractor' ? (rfi.contractor?.contact_name ?? 'Contractor') : 'Designer'}</span>
        {rfi.space_tag && <span>· Space: {rfi.space_tag}</span>}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
          {isOverdue
            ? `OVERDUE — ${format(deadline, "d MMM, h:mm a")}`
            : `Due in ${formatDistanceToNow(deadline)}`}
        </span>
        {rfi.linked_document && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
            📄 {rfi.linked_document.name}
          </span>
        )}
      </div>
    </div>
  )
}
