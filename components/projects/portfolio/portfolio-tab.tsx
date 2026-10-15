"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Eye, EyeOff, Trash2, GripVertical, Upload, Loader2, Check, Image as ImageIcon,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import {
  addGalleryItem,
  updateGalleryItem,
  reorderGalleryItems,
  deleteGalleryItem,
  updatePortfolioDetails,
  type PortfolioGalleryItem,
} from "@/app/actions/portfolio"
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
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ExportOptionsSheet } from "@/app/(studio)/dashboard/portfolio/export-options-sheet"

interface ProjectForPortfolio {
  id: string
  name: string
  type: string
  status: string
  portfolio_summary?: string | null
  portfolio_key_decisions?: string | null
  portfolio_location_city?: string | null
  portfolio_year_completed?: number | null
  portfolio_published?: boolean
  client?: { id: string; name: string } | null
  members?: Array<{ user_id: string; project_role: string; user: { id: string; name: string } | null }>
  cover_image_url?: string | null
}

interface Props {
  project: ProjectForPortfolio
  galleryItems: PortfolioGalleryItem[]
  studioId: string
  userRole: string
}

export function PortfolioTab({ project, galleryItems: initialGalleryItems, studioId, userRole }: Props) {
  const { toast } = useToast()
  const canManage = userRole === "owner" || userRole === "senior_designer"

  const [gallery, setGallery] = useState<PortfolioGalleryItem[]>(initialGalleryItems)
  const [uploading, setUploading] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Portfolio details form
  const [summary, setSummary] = useState(project.portfolio_summary ?? "")
  const [keyDecisions, setKeyDecisions] = useState(project.portfolio_key_decisions ?? "")
  const [city, setCity] = useState(project.portfolio_location_city ?? "")
  const [yearCompleted, setYearCompleted] = useState(String(project.portfolio_year_completed ?? ""))
  const [published, setPublished] = useState(project.portfolio_published ?? false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [savingPublished, setSavingPublished] = useState(false)
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function showSavedIndicator() {
    setSavedIndicator(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedIndicator(false), 2000)
  }

  async function handleBlurSave() {
    try {
      await updatePortfolioDetails(project.id, {
        portfolio_summary: summary,
        portfolio_key_decisions: keyDecisions,
        portfolio_location_city: city,
        portfolio_year_completed: yearCompleted ? parseInt(yearCompleted) : null,
      })
      showSavedIndicator()
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }

  async function handleTogglePublished(val: boolean) {
    if (!canManage) return
    setSavingPublished(true)
    try {
      await updatePortfolioDetails(project.id, { portfolio_published: val })
      setPublished(val)
      showSavedIndicator()
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setSavingPublished(false)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return
    setUploading(true)
    try {
      const supabase = createClient()
      const uploads = Array.from(files).map(async (file) => {
        const ts = Date.now()
        const rand = Math.random().toString(36).slice(2)
        const path = `${studioId}/${project.id}/portfolio/${ts}_${rand}/${file.name}`
        const { error } = await supabase.storage.from("project-files").upload(path, file)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path)
        return publicUrl
      })
      const urls = await Promise.all(uploads)
      const newItems = await Promise.all(
        urls.map((url) => addGalleryItem({ projectId: project.id, imageUrl: url }))
      )
      setGallery((prev) => [...prev, ...newItems])
    } catch {
      toast({ title: "Upload failed", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleToggleInclude(item: PortfolioGalleryItem) {
    try {
      const updated = await updateGalleryItem(item.id, { include_in_export: !item.include_in_export })
      setGallery((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    }
  }

  async function handleUpdateCaption(item: PortfolioGalleryItem, caption: string) {
    try {
      const updated = await updateGalleryItem(item.id, { caption })
      setGallery((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {}
  }

  async function handleUpdateSpaceTag(item: PortfolioGalleryItem, space_tag: string) {
    try {
      const updated = await updateGalleryItem(item.id, { space_tag: space_tag || null })
      setGallery((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {}
  }

  async function handleDelete(item: PortfolioGalleryItem) {
    if (!confirm("Remove this photo from the portfolio?")) return
    try {
      await deleteGalleryItem(item.id)
      setGallery((prev) => prev.filter((i) => i.id !== item.id))
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = gallery.findIndex((i) => i.id === active.id)
    const newIndex = gallery.findIndex((i) => i.id === over.id)
    const newOrder = [...gallery]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    setGallery(newOrder)
    try {
      await reorderGalleryItems(project.id, newOrder.map((i) => i.id))
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" })
    }
  }

  const portfolioProjectForExport = {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    cover_image_url: project.cover_image_url ?? null,
    portfolio_summary: summary,
    portfolio_key_decisions: keyDecisions,
    portfolio_location_city: city,
    portfolio_year_completed: yearCompleted ? parseInt(yearCompleted) : null,
    portfolio_published: published,
    client_name: project.client?.name ?? "",
    client_id: project.client?.id ?? null,
    updated_at: new Date().toISOString(),
    gallery_items: gallery,
    gallery_count: gallery.length,
    members: project.members ?? [],
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Gallery */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Project Photos</h3>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Photos
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-48 border border-dashed rounded-xl text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-30" />
            <p className="text-sm text-center max-w-xs">
              No photos uploaded yet. Upload final project photos to include them in portfolio exports.
            </p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Upload Photos
              </Button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={gallery.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((item) => (
                  <SortableGalleryTile
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onToggleInclude={handleToggleInclude}
                    onUpdateCaption={handleUpdateCaption}
                    onUpdateSpaceTag={handleUpdateSpaceTag}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Right: Portfolio Details card */}
      <div className="lg:w-72 shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Portfolio Details</CardTitle>
              {savedIndicator && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={published}
                  onCheckedChange={handleTogglePublished}
                  disabled={savingPublished}
                />
                <Label className="text-xs cursor-pointer">Published to Portfolio</Label>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canManage ? (
              <>
                <div>
                  <Label className="text-xs font-medium mb-1 block text-muted-foreground">Portfolio Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="A brief description..."
                    rows={3}
                    className="text-sm focus-visible:ring-[#e94560]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block text-muted-foreground">Key Design Decisions</Label>
                  <Textarea
                    value={keyDecisions}
                    onChange={(e) => setKeyDecisions(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="Notable design choices..."
                    rows={3}
                    className="text-sm focus-visible:ring-[#e94560]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block text-muted-foreground">City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="Bengaluru"
                    className="text-sm h-8 focus-visible:ring-[#e94560]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block text-muted-foreground">Year Completed</Label>
                  <Input
                    type="number"
                    value={yearCompleted}
                    onChange={(e) => setYearCompleted(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="2024"
                    min={1990}
                    max={2099}
                    className="text-sm h-8 focus-visible:ring-[#e94560]"
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground flex flex-col gap-2">
                {project.portfolio_summary && <p>{project.portfolio_summary}</p>}
                {project.portfolio_location_city && <p className="font-medium">{project.portfolio_location_city}</p>}
                {project.portfolio_year_completed && <p>Year: {project.portfolio_year_completed}</p>}
              </div>
            )}

            {canManage && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[#e94560] border-[#e94560] hover:bg-[#e94560]/5"
                  onClick={() => setExportOpen(true)}
                >
                  Export This Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {exportOpen && (
        <ExportOptionsSheet
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          allProjects={[portfolioProjectForExport]}
          preSelectedIds={[project.id]}
          studioName=""
        />
      )}
    </div>
  )
}

function SortableGalleryTile({
  item,
  canManage,
  onToggleInclude,
  onUpdateCaption,
  onUpdateSpaceTag,
  onDelete,
}: {
  item: PortfolioGalleryItem
  canManage: boolean
  onToggleInclude: (item: PortfolioGalleryItem) => void
  onUpdateCaption: (item: PortfolioGalleryItem, val: string) => void
  onUpdateSpaceTag: (item: PortfolioGalleryItem, val: string) => void
  onDelete: (item: PortfolioGalleryItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const [caption, setCaption] = useState(item.caption ?? "")
  const [spaceTag, setSpaceTag] = useState(item.space_tag ?? "")

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1">
      <div className="group relative rounded-lg overflow-hidden border aspect-square bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image_url} alt={item.caption ?? ""} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

        {canManage && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded"
          >
            <GripVertical className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {canManage && (
          <button
            onClick={() => onToggleInclude(item)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded"
            title={item.include_in_export ? "Exclude from export" : "Include in export"}
          >
            {item.include_in_export
              ? <Eye className="w-3.5 h-3.5 text-green-400" />
              : <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
          </button>
        )}

        {canManage && (
          <button
            onClick={() => onDelete(item)}
            className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}

        {canManage && (
          <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-2">
            <input
              type="text"
              value={spaceTag}
              onChange={(e) => setSpaceTag(e.target.value)}
              onBlur={() => onUpdateSpaceTag(item, spaceTag)}
              placeholder="Space tag..."
              className="text-xs text-white/70 bg-transparent outline-none w-full placeholder:text-white/30"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      {/* Caption: editable below the image for managers, read-only text for everyone else */}
      {canManage ? (
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => onUpdateCaption(item, caption)}
          placeholder="Caption..."
          className="text-xs bg-transparent border-b border-transparent hover:border-input focus:border-input outline-none w-full px-0.5 placeholder:text-muted-foreground/50"
        />
      ) : item.caption ? (
        <p className="text-xs text-muted-foreground truncate px-0.5" title={item.caption}>{item.caption}</p>
      ) : null}
    </div>
  )
}
