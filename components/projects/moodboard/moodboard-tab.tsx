"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  LayoutGrid,
  Eye,
  EyeOff,
  ExternalLink,
  MoreHorizontal,
  Plus,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  getMoodboards,
  reorderMoodboards,
  shareMoodboardWithClient,
  deleteMoodboard,
} from "@/app/actions/moodboards"
import type { Moodboard } from "@/app/actions/moodboards"
import { createMoodboardWithNewDesign } from "@/app/actions/canva"
import { MoodboardDetailSheet } from "./moodboard-detail-sheet"
import { DesignPickerSheet } from "./design-picker-sheet"
import { MoodboardSharePanel } from "./moodboard-share-panel"

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  shared_with_client: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-400",
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  shared_with_client: "Shared with Client",
  approved: "Approved",
  archived: "Archived",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── Sortable card ────────────────────────────────────────────────────────────

function SortableMoodboardCard({
  moodboard,
  isSelected,
  onSelect,
  onEdit,
  onShare,
  onArchive,
  onDelete,
}: {
  moodboard: Moodboard
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onShare: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: moodboard.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/5 ${
        isSelected ? "border-l-4 border-l-[#e94560] bg-accent/5 border-r border-t border-b" : "border-gray-200"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Thumbnail */}
      <div className="w-20 h-14 rounded overflow-hidden shrink-0 bg-gray-100">
        {moodboard.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={moodboard.thumbnail_url}
            alt={moodboard.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <LayoutGrid className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{moodboard.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusBadge status={moodboard.status} />
        </div>
      </div>

      {/* Visibility icon */}
      <div className="shrink-0">
        {moodboard.is_client_visible ? (
          <Eye className="w-4 h-4 text-green-600" />
        ) : (
          <EyeOff className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* 3-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare() }}>
            Share with Client
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive() }}>
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Embed viewer skeleton ────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-[65%]">
        <div className="h-[520px] bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div className="lg:w-[35%] flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ─── MoodboardTab ─────────────────────────────────────────────────────────────

export function MoodboardTab({
  projectId,
  studioId,
  canvaConnected,
  initialMoodboards,
}: {
  projectId: string
  studioId: string
  canvaConnected: boolean
  initialMoodboards: Moodboard[]
}) {
  const { toast } = useToast()
  const [moodboards, setMoodboards] = useState<Moodboard[]>(initialMoodboards)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMoodboards[0]?.id ?? null
  )

  // Detail sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [editingMoodboard, setEditingMoodboard] = useState<Moodboard | null>(null)

  // Design picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMoodboardId, setPickerMoodboardId] = useState<string | null>(null)

  // Share panel
  const [shareOpen, setShareOpen] = useState(false)
  const [sharingMoodboard, setSharingMoodboard] = useState<Moodboard | null>(null)

  // Creating
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const selected = moodboards.find((m) => m.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    const fresh = await getMoodboards(projectId).catch(() => moodboards)
    setMoodboards(fresh)
  }, [projectId, moodboards])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = moodboards.findIndex((m) => m.id === active.id)
    const newIndex = moodboards.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(moodboards, oldIndex, newIndex)
    setMoodboards(reordered)

    try {
      await reorderMoodboards(projectId, reordered.map((m) => m.id))
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" })
      await refresh()
    }
  }

  async function handleCreateInCanva() {
    setCreating(true)
    try {
      const created = await createMoodboardWithNewDesign({
        projectId,
        title: `Moodboard ${moodboards.length + 1}`,
      })
      setMoodboards((prev) => [...prev, created])
      setSelectedId(created.id)
      if (created.canva_edit_url) {
        window.open(created.canva_edit_url, "_blank", "noopener,noreferrer")
      }
      toast({ title: "Moodboard created" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateWithoutCanva() {
    setEditingMoodboard(null)
    setDetailSheetOpen(true)
  }

  async function handleShare(mb: Moodboard) {
    setSharingMoodboard(mb)
    setShareOpen(true)
  }

  async function handleArchive(mb: Moodboard) {
    try {
      const { updateMoodboard } = await import("@/app/actions/moodboards")
      await updateMoodboard(mb.id, { status: "archived", is_client_visible: false })
      await refresh()
      toast({ title: "Moodboard archived" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleDelete(mb: Moodboard) {
    if (!confirm(`Delete "${mb.title}"? This cannot be undone.`)) return
    try {
      await deleteMoodboard(mb.id)
      setMoodboards((prev) => prev.filter((m) => m.id !== mb.id))
      if (selectedId === mb.id) setSelectedId(moodboards.find((m) => m.id !== mb.id)?.id ?? null)
      toast({ title: "Moodboard deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Canva banner */}
      {!canvaConnected && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800">
            Connect your Canva account in Settings → Integrations to create and embed moodboards.
          </span>
          <a
            href="/dashboard/settings"
            className="shrink-0 text-[#e94560] font-medium hover:underline"
          >
            Go to Settings
          </a>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Moodboards</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="bg-[#e94560] hover:bg-[#c73651] text-white gap-1"
              disabled={creating}
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              New Moodboard
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleCreateInCanva}
              disabled={!canvaConnected}
            >
              Create in Canva
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!selected) return
                setPickerMoodboardId(selected.id)
                setPickerOpen(true)
              }}
              disabled={!canvaConnected || !selected}
            >
              Link Existing Canva Design
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateWithoutCanva}>
              Add Without Canva
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : moodboards.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">
            No moodboards yet. Create your first moodboard to start capturing design concepts
            for this project.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column — embed viewer */}
          <div className="lg:w-[65%]">
            {selected ? (
              <div className="flex flex-col gap-4">
                {/* Embed header */}
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm flex-1 min-w-0 truncate">
                    {selected.title}
                  </h3>
                  <StatusBadge status={selected.status} />

                  {selected.canva_edit_url && (
                    <a
                      href={selected.canva_edit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#e94560] hover:underline"
                    >
                      Open in Canva <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare(selected)}
                    className="text-xs"
                  >
                    Share with Client
                  </Button>
                </div>

                {/* Iframe or placeholder */}
                {selected.canva_embed_url ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200">
                    <IframeWithLoader
                      src={selected.canva_embed_url}
                      title={selected.title}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50"
                    style={{ height: 520 }}>
                    <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">No Canva design linked yet.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPickerMoodboardId(selected.id)
                        setPickerOpen(true)
                      }}
                      disabled={!canvaConnected}
                    >
                      Link Design
                    </Button>
                  </div>
                )}

                {/* Description */}
                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}

                {/* Client feedback */}
                {selected.client_feedback && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-amber-800 mb-1">Client Feedback</p>
                    <p className="text-sm text-amber-900">{selected.client_feedback}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Right column — moodboard list */}
          <div className="lg:w-[35%]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={moodboards.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {moodboards.map((mb) => (
                    <SortableMoodboardCard
                      key={mb.id}
                      moodboard={mb}
                      isSelected={mb.id === selectedId}
                      onSelect={() => setSelectedId(mb.id)}
                      onEdit={() => { setEditingMoodboard(mb); setDetailSheetOpen(true) }}
                      onShare={() => handleShare(mb)}
                      onArchive={() => handleArchive(mb)}
                      onDelete={() => handleDelete(mb)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* Sheets */}
      <MoodboardDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        moodboard={editingMoodboard}
        projectId={projectId}
        onSaved={async (updated) => {
          if (editingMoodboard) {
            setMoodboards((prev) => prev.map((m) => m.id === updated.id ? updated : m))
          } else {
            setMoodboards((prev) => [...prev, updated])
            setSelectedId(updated.id)
          }
          setDetailSheetOpen(false)
        }}
      />

      <DesignPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        moodboardId={pickerMoodboardId}
        onLinked={async (updated) => {
          setMoodboards((prev) => prev.map((m) => m.id === updated.id ? updated : m))
          setPickerOpen(false)
        }}
      />

      {sharingMoodboard && (
        <MoodboardSharePanel
          open={shareOpen}
          onOpenChange={setShareOpen}
          moodboard={sharingMoodboard}
          onShared={async (updated) => {
            setMoodboards((prev) => prev.map((m) => m.id === updated.id ? updated : m))
            setShareOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─── IframeWithLoader ─────────────────────────────────────────────────────────

function IframeWithLoader({ src, title }: { src: string; title: string }) {
  const [showSpinner, setShowSpinner] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSpinner(false), 2000)
    return () => clearTimeout(timer)
  }, [src])

  return (
    <div className="relative" style={{ height: "clamp(360px, 45vw, 520px)" }}>
      {showSpinner && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10"
          style={{ pointerEvents: "none" }}
        >
          <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      )}
      <iframe
        src={src}
        allowFullScreen
        loading="lazy"
        className="border-0 rounded-lg w-full h-full"
        title={title}
      />
    </div>
  )
}
