"use client"

import { useState } from "react"
import { isPast } from "date-fns"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/PermissionGate"
import { RfiCard } from "./rfi-card"
import { RaiseRfiSheet } from "./raise-rfi-sheet"
import { RfiDetailSheet } from "./rfi-detail-sheet"
import { deleteRfi } from "@/app/actions/rfis"
import { useToast } from "@/hooks/use-toast"
import { hasPermission } from "@/lib/permissions"
import type { RFI } from "@/app/actions/rfis"
import type { Contractor } from "@/app/actions/contractors"
import type { StudioRole } from "@/lib/supabase/types"

type StatusFilter = 'all' | RFI['status']

interface RfiTabProps {
  project: { id: string; studio_id: string; name: string }
  initialRfis: RFI[]
  currentUser: { id: string; name: string; role: string }
  projectDocuments: Array<{ id: string; name: string }>
  projectContractors: Contractor[]
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "open",         label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "responded",    label: "Responded" },
  { value: "closed",       label: "Closed" },
]

const SKELETON_COUNT = 3

export function RfiTab({ project, initialRfis, currentUser, projectDocuments, projectContractors }: RfiTabProps) {
  const { toast } = useToast()
  const [rfis, setRfis] = useState<RFI[]>(initialRfis)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [detailRfi, setDetailRfi] = useState<RFI | null>(null)
  const [loaded] = useState(true)

  const canManage = hasPermission(currentUser.role as StudioRole, "manage_rfis")

  const filtered = rfis.filter((r) => statusFilter === "all" || r.status === statusFilter)

  const overdueCount = rfis.filter(
    (r) => (r.status === 'open' || r.status === 'under_review') && isPast(new Date(r.response_deadline))
  ).length
  const respondedCount = rfis.filter((r) => r.status === 'responded').length
  const closedCount = rfis.filter((r) => r.status === 'closed').length
  const openCount = rfis.filter((r) => r.status === 'open' || r.status === 'under_review').length

  async function handleDelete(rfiId: string) {
    try {
      await deleteRfi(rfiId)
      setRfis((prev) => prev.filter((r) => r.id !== rfiId))
      toast({ title: "RFI deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <PermissionGate action="manage_rfis">
          <Button
            size="sm"
            onClick={() => setRaiseOpen(true)}
            className="bg-[#e94560] hover:bg-[#d63850] text-white gap-1.5"
          >
            + Raise RFI
          </Button>
        </PermissionGate>

        <div className="flex gap-1.5 flex-wrap ml-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-[#1a1a2e] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">Open: {openCount}</span>
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${overdueCount > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
          Overdue: {overdueCount}
        </span>
        <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-medium">Responded: {respondedCount}</span>
        <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">Closed: {closedCount}</span>
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
          <ClipboardList className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-gray-700">
              {rfis.length === 0 ? "No RFIs raised yet." : "No RFIs match the filter."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {rfis.length === 0 ? "Raise your first RFI." : "Try a different filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((rfi) => (
            <RfiCard
              key={rfi.id}
              rfi={rfi}
              onClick={() => setDetailRfi(rfi)}
              onRespond={() => setDetailRfi(rfi)}
              onChangeStatus={() => setDetailRfi(rfi)}
              onDelete={() => handleDelete(rfi.id)}
            />
          ))}
        </div>
      )}

      <RaiseRfiSheet
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        project={project}
        projectDocuments={projectDocuments}
        projectContractors={projectContractors}
        onCreated={(r) => setRfis((prev) => [r, ...prev])}
      />

      {detailRfi && (
        <RfiDetailSheet
          open={!!detailRfi}
          onOpenChange={(v) => { if (!v) setDetailRfi(null) }}
          rfi={detailRfi}
          canManage={canManage}
          onUpdated={(r) => {
            setRfis((prev) => prev.map((x) => x.id === r.id ? r : x))
            setDetailRfi(r)
          }}
        />
      )}
    </div>
  )
}
