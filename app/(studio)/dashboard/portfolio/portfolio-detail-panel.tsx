"use client"

import { useState, useRef, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  type PortfolioProject,
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  className: "bg-gray-100 text-gray-500" },
}

interface Props {
  project: PortfolioProject
  defaultTab?: "details" | "gallery"
  open: boolean
  onClose: () => void
  onUpdate: (updated: PortfolioProject) => void
  currentUserRole: string
}

export function PortfolioDetailPanel({ project, defaultTab = "details", open, onClose, onUpdate, currentUserRole }: Props) {
  const { toast } = useToast()
  const canManage = currentUserRole === "owner" || currentUserRole === "senior_designer"

  const [localProject, setLocalProject] = useState(project)
  const [galleryItems, setGalleryItems] = useState<PortfolioGalleryItem[]>(project.gallery_items)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Details form state
  const [summary, setSummary] = useState(project.portfolio_summary ?? "")
  const [keyDecisions, setKeyDecisions] = useState(project.portfolio_key_decisions ?? "")
  const [city, setCity] = useState(project.portfolio_location_city ?? "")
  const [yearCompleted, setYearCompleted] = useState<string>(String(project.portfolio_year_completed ?? ""))

  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleTogglePublished() {
    if (!canManage) return
    setToggling(true)
    try {
      const newVal = !localProject.portfolio_published
      await updatePortfolioDetails(localProject.id, { portfolio_published: newVal })
      const updated = { ...localProject, portfolio_published: newVal }
      setLocalProject(updated)
      onUpdate({ ...project, ...updated, gallery_items: galleryItems, gallery_count: galleryItems.length })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setToggling(false)
    }
  }

  async function handleSaveDetails() {
    setSaving(true)
    try {
      await updatePortfolioDetails(localProject.id, {
        portfolio_summary: summary,
        portfolio_key_decisions: keyDecisions,
        portfolio_location_city: city,
        portfolio_year_completed: yearCompleted ? parseInt(yearCompleted) : null,
      })
      const updated = {
        ...localProject,
        portfolio_summary: summary,
        portfolio_key_decisions: keyDecisions,
        portfolio_location_city: city,
        portfolio_year_completed: yearCompleted ? parseInt(yearCompleted) : null,
      }
      setLocalProject(updated)
      onUpdate({ ...project, ...updated, gallery_items: galleryItems, gallery_count: galleryItems.length })
      toast({ title: "Portfolio details saved." })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from("users").select("studio_id").eq("id", user!.id).single()
      const studioId = profile!.studio_id

      const uploads = Array.from(files).map(async (file) => {
        const ts = Date.now()
        const rand = Math.random().toString(36).slice(2)
        const path = `${studioId}/${localProject.id}/portfolio/${ts}_${rand}/${file.name}`
        const { error } = await supabase.storage.from("project-files").upload(path, file)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path)
        return publicUrl
      })

      const urls = await Promise.all(uploads)
      const newItems = await Promise.all(
        urls.map((url) => addGalleryItem({ projectId: localProject.id, imageUrl: url }))
      )
      setGalleryItems((prev) => [...prev, ...newItems])
      onUpdate({ ...project, ...localProject, gallery_items: [...galleryItems, ...newItems], gallery_count: galleryItems.length + newItems.length })
    } catch {
      toast({ title: "Upload failed", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleToggleInclude(item: PortfolioGalleryItem) {
    try {
      const updated = await updateGalleryItem(item.id, { include_in_export: !item.include_in_export })
      setGalleryItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    }
  }

  async function handleUpdateCaption(item: PortfolioGalleryItem, caption: string) {
    try {
      const updated = await updateGalleryItem(item.id, { caption })
      setGalleryItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {}
  }

  async function handleUpdateSpaceTag(item: PortfolioGalleryItem, space_tag: string) {
    try {
      const updated = await updateGalleryItem(item.id, { space_tag: space_tag || null })
      setGalleryItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    } catch {}
  }

  async function handleDelete(item: PortfolioGalleryItem) {
    if (!confirm("Remove this photo from the portfolio?")) return
    try {
      await deleteGalleryItem(item.id)
      const next = galleryItems.filter((i) => i.id !== item.id)
      setGalleryItems(next)
      onUpdate({ ...project, ...localProject, gallery_items: next, gallery_count: next.length })
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = galleryItems.findIndex((i) => i.id === active.id)
    const newIndex = galleryItems.findIndex((i) => i.id === over.id)
    const newOrder = [...galleryItems]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    setGalleryItems(newOrder)
    try {
      await reorderGalleryItems(localProject.id, newOrder.map((i) => i.id))
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" })
    }
  }

  const statusMeta = STATUS_BADGE[localProject.status] ?? STATUS_BADGE.active

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold truncate">{localProject.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium capitalize">{localProject.type}</span>
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={localProject.portfolio_published}
                  onCheckedChange={handleTogglePublished}
                  disabled={toggling}
                />
                <Label className="text-xs">Published to Portfolio</Label>
              </div>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex-1">
          <TabsList className="w-full justify-start bg-transparent border-b rounded-none px-6 gap-0 h-auto p-0">
            {[
              { label: "Details", value: "details" },
              { label: "Gallery", value: "gallery" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#e94560] data-[state=active]:bg-transparent data-[state=active]:text-[#e94560] px-4 pb-2"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Details Tab ── */}
          <TabsContent value="details" className="px-6 py-4 flex flex-col gap-4">
            {canManage && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Portfolio Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="A brief description of the project for portfolio use"
                    rows={3}
                    className="focus-visible:ring-[#e94560]"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Key Design Decisions</Label>
                  <Textarea
                    value={keyDecisions}
                    onChange={(e) => setKeyDecisions(e.target.value)}
                    placeholder="Notable design choices, challenges solved, materials selected"
                    rows={3}
                    className="focus-visible:ring-[#e94560]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">City</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Bengaluru"
                      className="focus-visible:ring-[#e94560]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Year Completed</Label>
                    <Input
                      type="number"
                      value={yearCompleted}
                      onChange={(e) => setYearCompleted(e.target.value)}
                      placeholder="2024"
                      min={1990}
                      max={2099}
                      className="focus-visible:ring-[#e94560]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Read-only metadata */}
            <div className="border-t pt-4 flex flex-col gap-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Project Type</span>
                <span className="capitalize">{localProject.type}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Status</span>
                <Badge className={`text-xs border-0 ${statusMeta.className}`}>{statusMeta.label}</Badge>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Client</span>
                <span>{localProject.client_name || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Team</span>
                <span>{localProject.members.map((m) => m.user?.name).filter(Boolean).join(", ") || "—"}</span>
              </div>
            </div>

            {canManage && (
              <div className="border-t pt-4">
                <Button
                  onClick={handleSaveDetails}
                  disabled={saving}
                  className="bg-[#e94560] hover:bg-[#c73652] text-white w-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Details
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Gallery Tab ── */}
          <TabsContent value="gallery" className="px-6 py-4 flex flex-col gap-4">
            {canManage && (
              <div className="flex items-center gap-3">
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </div>
            )}

            {galleryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 h-40 border border-dashed rounded-xl text-muted-foreground">
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
                <SortableContext items={galleryItems.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 gap-3">
                    {galleryItems.map((item) => (
                      <SortableGalleryItem
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
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function SortableGalleryItem({
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
    <div ref={setNodeRef} style={style} className="group relative rounded-lg overflow-hidden border aspect-square bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt={item.caption ?? ""} className="w-full h-full object-cover" />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

      {/* Drag handle */}
      {canManage && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded"
        >
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      {/* Include/exclude toggle */}
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

      {/* Delete button */}
      {canManage && (
        <button
          onClick={() => onDelete(item)}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      )}

      {/* Caption + space tag on hover */}
      <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-2 flex flex-col gap-1">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => onUpdateCaption(item, caption)}
          placeholder="Caption..."
          className="text-xs text-white bg-transparent border-b border-white/30 outline-none w-full placeholder:text-white/50"
          onClick={(e) => e.stopPropagation()}
        />
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
    </div>
  )
}
