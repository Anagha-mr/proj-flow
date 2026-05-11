"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, ArrowRight, Share2, Archive, Check } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  type ProcurementSchedule,
} from "@/app/actions/procurement"
import { ScheduleDetail } from "./schedule-detail"
import { ScheduleSharePanel } from "./schedule-share-panel"
import { useToast } from "@/hooks/use-toast"

interface SchedulesTabProps {
  projectId: string
  studioId: string
  userRole: string
  currentUserId: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:       { label: "Draft",       className: "bg-slate-100 text-slate-600" },
  in_review:   { label: "In Review",   className: "bg-amber-100 text-amber-700" },
  approved:    { label: "Approved",    className: "bg-green-100 text-green-700" },
  ordered:     { label: "Ordered",     className: "bg-blue-100 text-blue-700" },
  delivered:   { label: "Delivered",   className: "bg-teal-100 text-teal-700" },
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

export function SchedulesTab({ projectId, studioId, userRole, currentUserId }: SchedulesTabProps) {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<ProcurementSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeSchedule, setActiveSchedule] = useState<ProcurementSchedule | null>(null)
  const [shareSchedule, setShareSchedule] = useState<ProcurementSchedule | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameVal, setEditingNameVal] = useState("")

  const canManage = userRole === "owner" || userRole === "senior_designer" || userRole === "designer"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSchedules(projectId)
      setSchedules(data)
    } catch {
      toast({ title: "Failed to load schedules", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!canManage) return
    setCreating(true)
    try {
      const schedule = await createSchedule({ projectId, name: "Untitled" })
      setSchedules((prev) => [schedule, ...prev])
      setActiveSchedule(schedule)
      toast({ title: "Schedule created" })
    } catch {
      toast({ title: "Failed to create schedule", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleArchive(schedule: ProcurementSchedule) {
    try {
      await updateSchedule(schedule.id, { is_archived: !schedule.is_archived })
      await load()
      toast({ title: schedule.is_archived ? "Schedule unarchived" : "Schedule archived" })
    } catch {
      toast({ title: "Failed to archive schedule", variant: "destructive" })
    }
  }

  async function handleSaveName(scheduleId: string) {
    if (!editingNameVal.trim()) return
    try {
      await updateSchedule(scheduleId, { name: editingNameVal.trim() })
      setSchedules((prev) =>
        prev.map((s) => s.id === scheduleId ? { ...s, name: editingNameVal.trim() } : s)
      )
    } catch {
      toast({ title: "Failed to rename schedule", variant: "destructive" })
    } finally {
      setEditingNameId(null)
    }
  }

  if (activeSchedule) {
    return (
      <ScheduleDetail
        schedule={activeSchedule}
        projectId={projectId}
        studioId={studioId}
        userRole={userRole}
        currentUserId={currentUserId}
        onBack={() => { setActiveSchedule(null); load() }}
        onScheduleUpdate={(updated) => setActiveSchedule(updated)}
      />
    )
  }

  const archivedCount = schedules.filter((s) => s.is_archived).length
  const visible = schedules.filter((s) => showArchived || !s.is_archived)

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">Procurement Schedules</h2>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
              className="text-muted-foreground"
            >
              {showArchived ? "Hide Archived" : `Show Archived (${archivedCount})`}
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={handleCreate}
              disabled={creating}
            >
              <Plus className="w-4 h-4 mr-1" />
              {creating ? "Creating…" : "Create Schedule"}
            </Button>
          )}
        </div>
      </div>

      {/* Schedule list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 flex flex-col items-center gap-3 text-center">
          <p className="font-medium text-muted-foreground">No procurement schedules yet</p>
          {canManage && (
            <Button
              size="sm"
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={handleCreate}
              disabled={creating}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create your first schedule
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((schedule) => {
            const statusMeta = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.draft
            return (
              <div
                key={schedule.id}
                className={`border rounded-lg p-4 hover:border-[#e94560]/50 transition-colors ${schedule.is_archived ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {editingNameId === schedule.id ? (
                        <Input
                          autoFocus
                          value={editingNameVal}
                          onChange={(e) => setEditingNameVal(e.target.value)}
                          onBlur={() => handleSaveName(schedule.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveName(schedule.id)
                            if (e.key === "Escape") setEditingNameId(null)
                          }}
                          className="h-7 text-sm font-semibold w-48 focus-visible:ring-[#e94560]"
                        />
                      ) : (
                        <button
                          className="font-semibold text-sm hover:text-[#e94560] transition-colors"
                          onClick={() => {
                            if (!canManage) return
                            setEditingNameId(schedule.id)
                            setEditingNameVal(schedule.name)
                          }}
                        >
                          {schedule.name}
                        </button>
                      )}
                      <Badge className={`text-xs px-2 py-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </Badge>
                      <Badge className="text-xs px-2 py-0 bg-gray-100 text-gray-600">
                        {schedule.view_type === "room_based" ? "Room" : "Schedule"}
                      </Badge>
                    </div>

                    {/* Meta row */}
                    <p className="text-xs text-muted-foreground">
                      {schedule.owner?.name && <span>{schedule.owner.name} · </span>}
                      <span>{schedule.item_count ?? 0} items</span>
                      {(schedule.total_cost ?? 0) > 0 && (
                        <span> · {formatINR(schedule.total_cost ?? 0)} total</span>
                      )}
                      <span> · updated {formatDistanceToNow(new Date(schedule.updated_at), { addSuffix: true })}</span>
                    </p>

                    {/* Portal indicator */}
                    <div className="mt-1.5 flex items-center gap-1">
                      {schedule.is_client_published ? (
                        <>
                          <span className="text-green-500 text-xs">●</span>
                          <span className="text-xs text-green-600">Live on Portal</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground text-xs">●</span>
                          <span className="text-xs text-muted-foreground">Not Shared</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 px-3"
                      onClick={() => setShareSchedule(schedule)}
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1" />
                      Share
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs h-8 px-3 bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
                      onClick={() => setActiveSchedule(schedule)}
                    >
                      Open
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleArchive(schedule)}>
                          {schedule.is_archived ? (
                            <><Check className="w-4 h-4 mr-2" />Unarchive</>
                          ) : (
                            <><Archive className="w-4 h-4 mr-2" />Archive</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {shareSchedule && (
        <ScheduleSharePanel
          open={!!shareSchedule}
          onOpenChange={(open) => { if (!open) setShareSchedule(null) }}
          schedule={shareSchedule}
          onRefresh={load}
        />
      )}
    </div>
  )
}
