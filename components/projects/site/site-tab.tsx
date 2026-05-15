"use client"

import { useState } from "react"
import { Camera, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/PermissionGate"
import { SiteUpdateCard } from "./site-update-card"
import { UploadSiteUpdateSheet } from "./upload-site-update-sheet"
import { toggleClientVisible, deleteSiteUpdate } from "@/app/actions/site"
import { useToast } from "@/hooks/use-toast"
import type { SiteUpdate } from "@/app/actions/site"

type PhaseFilter = "all" | "before" | "during" | "after"

interface SiteTabProps {
  project: { id: string; studio_id: string }
  initialUpdates: SiteUpdate[]
  currentUser: { id: string; role: string }
}

const SKELETON_COUNT = 6

export function SiteTab({ project, initialUpdates, currentUser }: SiteTabProps) {
  const { toast } = useToast()
  const [updates, setUpdates] = useState<SiteUpdate[]>(initialUpdates)
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all")
  const [spaceSearch, setSpaceSearch] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isLoaded] = useState(true)

  const filtered = updates.filter((u) => {
    if (phaseFilter !== "all" && u.phase_tag !== phaseFilter) return false
    if (spaceSearch && !(u.space_tag ?? "").toLowerCase().includes(spaceSearch.toLowerCase())) return false
    return true
  })

  const existingSpaceTags = [...new Set(updates.map((u) => u.space_tag).filter(Boolean))] as string[]

  const canDelete = currentUser.role === "owner" || currentUser.role === "senior_designer"

  async function handleToggleVisible(update: SiteUpdate) {
    try {
      await toggleClientVisible(update.id, !update.is_client_visible)
      setUpdates((prev) =>
        prev.map((u) => u.id === update.id ? { ...u, is_client_visible: !u.is_client_visible } : u)
      )
    } catch (err) {
      toast({ title: "Failed to update", description: String(err), variant: "destructive" })
    }
  }

  async function handleDelete(updateId: string) {
    try {
      await deleteSiteUpdate(updateId)
      setUpdates((prev) => prev.filter((u) => u.id !== updateId))
      toast({ title: "Deleted" })
    } catch (err) {
      toast({ title: "Failed to delete", description: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Phase filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "before", "during", "after"] as const).map((phase) => (
            <button
              key={phase}
              onClick={() => setPhaseFilter(phase)}
              className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors capitalize ${
                phaseFilter === phase
                  ? "bg-[#1a1a2e] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {phase === "all" ? "All" : phase}
            </button>
          ))}
        </div>

        {/* Space filter */}
        <Input
          value={spaceSearch}
          onChange={(e) => setSpaceSearch(e.target.value)}
          placeholder="Filter by space…"
          className="w-48 h-8 text-sm focus-visible:ring-[#e94560]"
        />

        {/* Upload button gated by permission */}
        <PermissionGate action="manage_site">
          <Button
            onClick={() => setUploadOpen(true)}
            size="sm"
            className="ml-auto bg-[#e94560] hover:bg-[#d63850] text-white gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Upload Update
          </Button>
        </PermissionGate>
      </div>

      {/* Grid */}
      {!isLoaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="rounded-lg bg-gray-100 animate-pulse" style={{ aspectRatio: "4/3" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Camera className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-gray-700">
              {updates.length === 0 ? "No site updates yet." : "No updates match your filters."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {updates.length === 0 ? "Upload the first one." : "Try adjusting your filters."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((update) => (
            <SiteUpdateCard
              key={update.id}
              update={update}
              onToggleVisible={() => handleToggleVisible(update)}
              onDelete={() => handleDelete(update.id)}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Upload sheet */}
      <UploadSiteUpdateSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={project.id}
        studioId={project.studio_id}
        onCreated={(newUpdate) => setUpdates((prev) => [newUpdate, ...prev])}
        existingSpaceTags={existingSpaceTags}
      />
    </div>
  )
}
