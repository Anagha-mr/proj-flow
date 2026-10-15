"use client"

import { useState } from "react"
import { Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/PermissionGate"
import { SnagCard } from "./snag-card"
import { AddSnagSheet } from "./add-snag-sheet"
import { SnagDetailSheet } from "./snag-detail-sheet"
import { updateSnagStatus, reopenSnagItem, deleteSnagItem, resolveSnagItem } from "@/app/actions/snags"
import { hasPermission } from "@/lib/permissions"
import { useToast } from "@/hooks/use-toast"
import type { SnagItem } from "@/app/actions/snags"
import type { Contractor } from "@/app/actions/contractors"
import type { StudioRole } from "@/lib/supabase/types"

type StatusFilter = 'all' | SnagItem['status']

interface StudioUser { id: string; name: string; role: string }

interface SnagTabProps {
  project: { id: string; studio_id: string; name: string }
  initialSnags: SnagItem[]
  currentUser: { id: string; name: string; role: string }
  projectContractors: Contractor[]
  studioUsers: StudioUser[]
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",              label: "All" },
  { value: "open",             label: "Open" },
  { value: "in_progress",      label: "In Progress" },
  { value: "resolved",         label: "Resolved" },
  { value: "client_signed_off", label: "Signed Off" },
]

const SKELETON_COUNT = 4

export function SnagTab({ project, initialSnags, currentUser, projectContractors, studioUsers }: SnagTabProps) {
  const { toast } = useToast()
  const [snags, setSnags] = useState<SnagItem[]>(initialSnags)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [addOpen, setAddOpen] = useState(false)
  const [editSnag, setEditSnag] = useState<SnagItem | null>(null)
  const [detailSnag, setDetailSnag] = useState<SnagItem | null>(null)
  const [loaded] = useState(true)

  const canManage = hasPermission(currentUser.role as StudioRole, "manage_snags")

  const filtered = snags.filter((s) => statusFilter === "all" || s.status === statusFilter)

  const openCount = snags.filter((s) => s.status === 'open').length
  const inProgressCount = snags.filter((s) => s.status === 'in_progress').length
  const resolvedCount = snags.filter((s) => s.status === 'resolved').length
  const signedOffCount = snags.filter((s) => s.status === 'client_signed_off').length

  async function handleMarkInProgress(snagId: string) {
    try {
      await updateSnagStatus(snagId, 'in_progress')
      setSnags((prev) => prev.map((s) => s.id === snagId ? { ...s, status: 'in_progress' as SnagItem['status'] } : s))
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleResolve(snag: SnagItem) {
    setDetailSnag(snag)
  }

  async function handleReopen(snagId: string) {
    try {
      await reopenSnagItem(snagId)
      setSnags((prev) => prev.map((s) => s.id === snagId ? { ...s, status: 'open' as SnagItem['status'], resolution_photo_url: null, resolution_note: null } : s))
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleDelete(snagId: string) {
    try {
      await deleteSnagItem(snagId)
      setSnags((prev) => prev.filter((s) => s.id !== snagId))
      toast({ title: "Snag item deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <PermissionGate action="manage_snags">
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-[#e94560] hover:bg-[#d63850] text-white gap-1.5"
          >
            + Add Snag
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
        <span className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-700 font-medium">Open: {openCount}</span>
        <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-medium">In Progress: {inProgressCount}</span>
        <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">Resolved: {resolvedCount}</span>
        <span className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-medium">Signed Off: {signedOffCount}</span>
      </div>

      {/* Grid */}
      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-100 animate-pulse aspect-[4/3]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Bug className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-gray-700">
              {snags.length === 0 ? "No snag items yet." : "No items match the filter."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {snags.length === 0 ? "Add the first snag item." : "Try a different filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((snag) => (
            <SnagCard
              key={snag.id}
              snag={snag}
              onClick={() => setDetailSnag(snag)}
              onMarkInProgress={() => handleMarkInProgress(snag.id)}
              onResolve={() => handleResolve(snag)}
              onReopen={() => handleReopen(snag.id)}
              onDelete={() => handleDelete(snag.id)}
            />
          ))}
        </div>
      )}

      <AddSnagSheet
        open={addOpen || !!editSnag}
        onOpenChange={(v) => { if (!v) { setAddOpen(false); setEditSnag(null) } }}
        project={project}
        projectContractors={projectContractors}
        studioUsers={studioUsers}
        editSnag={editSnag}
        onCreated={(s) => setSnags((prev) => [s, ...prev])}
        onUpdated={(s) => {
          setSnags((prev) => prev.map((x) => x.id === s.id ? s : x))
          setDetailSnag((prev) => (prev && prev.id === s.id ? s : prev))
          setEditSnag(null)
        }}
      />

      {detailSnag && (
        <SnagDetailSheet
          open={!!detailSnag}
          onOpenChange={(v) => { if (!v) setDetailSnag(null) }}
          snag={detailSnag}
          canManage={canManage}
          studioId={project.studio_id}
          projectId={project.id}
          onUpdated={(s) => {
            setSnags((prev) => prev.map((x) => x.id === s.id ? s : x))
            setDetailSnag(s)
          }}
          onDeleted={(id) => {
            setSnags((prev) => prev.filter((x) => x.id !== id))
            setDetailSnag(null)
          }}
          onEdit={(s) => setEditSnag(s)}
        />
      )}
    </div>
  )
}
