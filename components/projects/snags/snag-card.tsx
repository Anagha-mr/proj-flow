"use client"

import { useState } from "react"
import { formatDistanceToNow, isPast } from "date-fns"
import { MoreVertical } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { SnagItem } from "@/app/actions/snags"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:              { label: "Open",            className: "bg-red-100 text-red-700" },
  in_progress:       { label: "In Progress",     className: "bg-amber-100 text-amber-700" },
  resolved:          { label: "Resolved",        className: "bg-blue-100 text-blue-700" },
  client_signed_off: { label: "Signed Off",      className: "bg-green-100 text-green-700" },
}

const ASSIGNEE_BADGE: Record<string, string> = {
  contractor: "bg-orange-100 text-orange-700",
  vendor:     "bg-purple-100 text-purple-700",
  designer:   "bg-blue-100 text-blue-700",
}

interface SnagCardProps {
  snag: SnagItem
  onClick: () => void
  onMarkInProgress: () => void
  onResolve: () => void
  onReopen: () => void
  onDelete: () => void
}

export function SnagCard({ snag, onClick, onMarkInProgress, onResolve, onReopen, onDelete }: SnagCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const statusMeta = STATUS_BADGE[snag.status] ?? STATUS_BADGE.open
  const assigneeBadge = ASSIGNEE_BADGE[snag.assigned_to_type] ?? "bg-gray-100 text-gray-600"
  const dueDate = snag.due_date ? new Date(snag.due_date + "T00:00:00") : null
  const isOverdue = dueDate && isPast(dueDate) && snag.status !== 'resolved' && snag.status !== 'client_signed_off'

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-card-click]")) return
          onClick()
        }}
      >
        {/* Photo */}
        <div
          className="relative aspect-[4/3] overflow-hidden bg-gray-100"
          data-no-card-click
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snag.photo_url}
            alt={snag.location_description}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex gap-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${assigneeBadge}`}>
                {snag.assigned_to_type}
              </span>
            </div>
            <div data-no-card-click>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onClick}>View Detail</DropdownMenuItem>
                  {snag.status === 'open' && (
                    <DropdownMenuItem onClick={onMarkInProgress}>Mark In Progress</DropdownMenuItem>
                  )}
                  {(snag.status === 'open' || snag.status === 'in_progress') && (
                    <DropdownMenuItem onClick={onResolve}>Resolve</DropdownMenuItem>
                  )}
                  {snag.status === 'resolved' && (
                    <DropdownMenuItem onClick={onReopen}>Reopen</DropdownMenuItem>
                  )}
                  {snag.status === 'open' && (
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="font-semibold text-sm text-gray-900 mt-1.5 line-clamp-1">{snag.location_description}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{snag.description}</p>

          {dueDate && (
            <p className={`text-xs mt-1.5 font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
              {isOverdue ? "Overdue" : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`}
            </p>
          )}

          {snag.status === 'resolved' && (
            <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
              Awaiting client sign-off
            </div>
          )}
          {snag.status === 'client_signed_off' && (
            <div className="mt-2 text-xs bg-green-50 border border-green-200 text-green-800 rounded px-2 py-1">
              Client Signed Off ✓
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snag.photo_url} alt={snag.location_description} className="w-full h-auto max-h-[80vh] object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
