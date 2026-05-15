"use client"

import { useState } from "react"
import { format } from "date-fns"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { deleteTimeEntry, type TimeEntry } from "@/app/actions/time-tracking"

interface TimeEntryRowProps {
  entry: TimeEntry
  canDelete: boolean
  canEdit: boolean
  onEdit: (entry: TimeEntry) => void
  onDeleted: (id: string) => void
}

export function TimeEntryRow({ entry, canDelete, canEdit, onEdit, onDeleted }: TimeEntryRowProps) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTimeEntry(entry.id)
      onDeleted(entry.id)
      toast({ title: "Time entry deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const dateLabel = (() => {
    try {
      return format(new Date(entry.entry_date + "T00:00:00"), "EEE d MMM")
    } catch {
      return entry.entry_date
    }
  })()

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-white rounded-lg border hover:shadow-sm transition-shadow">
      <div className="w-24 shrink-0">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        {entry.user && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#1a1a2e] text-white text-xs flex items-center justify-center shrink-0">
              {entry.user.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 truncate max-w-[100px]">{entry.user.name}</span>
          </div>
        )}

        {entry.phase_tag && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{entry.phase_tag}</span>
        )}

        {entry.notes && (
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{entry.notes}</span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-2xl font-bold text-[#1a1a2e]">{entry.hours}<span className="text-base font-normal">h</span></span>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.is_billable ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          {entry.is_billable ? "Billable" : "Non-billable"}
        </span>

        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={deleting}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(entry)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
