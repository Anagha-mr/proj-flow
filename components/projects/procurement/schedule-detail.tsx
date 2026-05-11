"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ArrowLeft,
  Plus,
  GripVertical,
  MoreHorizontal,
  Package,
  Flag,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Share2,
} from "lucide-react"
import {
  getItems,
  createItem,
  updateSchedule,
  archiveItem,
  deleteItem,
  updateItem,
  reorderItems,
  enrichItemFromUrl,
  type ProcurementSchedule,
  type ProcurementItem,
  type ViewType,
} from "@/app/actions/procurement"
import { ItemDetailPanel } from "./item-detail-panel"
import { ScheduleSharePanel } from "./schedule-share-panel"
import { useToast } from "@/hooks/use-toast"

interface ScheduleDetailProps {
  schedule: ProcurementSchedule
  projectId: string
  studioId: string
  userRole: string
  currentUserId: string
  onBack: () => void
  onScheduleUpdate: (schedule: ProcurementSchedule) => void
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:       { label: "Draft",       className: "bg-slate-100 text-slate-600" },
  in_review:   { label: "In Review",   className: "bg-amber-100 text-amber-700" },
  approved:    { label: "Approved",    className: "bg-green-100 text-green-700" },
  ordered:     { label: "Ordered",     className: "bg-blue-100 text-blue-700" },
  delivered:   { label: "Delivered",   className: "bg-teal-100 text-teal-700" },
}

const CURATION_BADGE: Record<string, { label: string; className: string }> = {
  draft:               { label: "Draft",               className: "bg-slate-100 text-slate-600" },
  hidden:              { label: "Hidden",              className: "bg-gray-100 text-gray-500" },
  quoting:             { label: "Quoting",             className: "bg-amber-100 text-amber-700" },
  selected:            { label: "Selected",            className: "bg-blue-100 text-blue-700" },
  internal_review:     { label: "Internal Review",     className: "bg-orange-100 text-orange-700" },
  internally_approved: { label: "Internally Approved", className: "bg-green-100 text-green-700" },
}

const CLIENT_BADGE: Record<string, { label: string; className: string }> = {
  client_review: { label: "Pending",   className: "bg-amber-100 text-amber-700" },
  approved:      { label: "Approved",  className: "bg-green-100 text-green-700" },
  rejected:      { label: "Rejected",  className: "bg-red-100 text-red-700" },
  resubmit:      { label: "Revision",  className: "bg-orange-100 text-orange-700" },
  closed:        { label: "Closed",    className: "bg-slate-100 text-slate-600" },
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

function groupItems(items: ProcurementItem[]): Record<string, ProcurementItem[]> {
  const groups: Record<string, ProcurementItem[]> = {}
  for (const item of items) {
    const key = item.room_or_category || "Uncategorised"
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

// ─── Sortable Item Row ────────────────────────────────────────────────────────

function SortableItemRow({
  item,
  onOpen,
  onArchive,
  onDelete,
  onFlag,
}: {
  item: ProcurementItem
  onOpen: (item: ProcurementItem) => void
  onArchive: (itemId: string) => void
  onDelete: (itemId: string) => void
  onFlag: (item: ProcurementItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const curation = item.status?.curation_status
  const clientApproval = item.status?.client_approval_status
  const curationMeta = curation ? CURATION_BADGE[curation] : null
  const clientMeta = clientApproval ? CLIENT_BADGE[clientApproval] : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 border-b last:border-0 py-2 px-2 hover:bg-muted/30 cursor-pointer rounded"
      onClick={() => onOpen(item)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
        )}
      </div>

      {/* Brand */}
      <div className="hidden md:block w-24 text-xs text-muted-foreground truncate">
        {item.brand || "—"}
      </div>

      {/* Supplier */}
      <div className="hidden lg:block w-24 text-xs text-muted-foreground truncate">
        {item.supplier_name || "—"}
      </div>

      {/* Qty */}
      <div className="w-10 text-xs text-center">{item.quantity}</div>

      {/* Unit cost */}
      <div className="hidden md:block w-20 text-xs text-right">
        {formatINR(item.unit_cost)}
      </div>

      {/* Total */}
      <div className="w-24 text-xs text-right font-medium">
        {formatINR(item.total_cost)}
      </div>

      {/* Status badges */}
      <div className="hidden lg:flex items-center gap-1">
        {curationMeta && (
          <Badge className={`text-xs px-1.5 py-0 ${curationMeta.className}`}>
            {curationMeta.label}
          </Badge>
        )}
        {clientMeta && (
          <Badge className={`text-xs px-1.5 py-0 ${clientMeta.className}`}>
            {clientMeta.label}
          </Badge>
        )}
      </div>

      {/* Flag */}
      {item.is_flagged && <Flag className="w-3.5 h-3.5 text-[#e94560] shrink-0" />}

      {/* 3-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onOpen(item)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onFlag(item)}>
            {item.is_flagged ? "Unflag" : "Flag"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onArchive(item.id)}>Archive</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(item.id)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({
  groupName,
  items,
  projectId,
  scheduleId,
  studioId,
  onItemOpen,
  onItemArchive,
  onItemDelete,
  onItemFlag,
  onDragEnd,
  onQuickAdd,
}: {
  groupName: string
  items: ProcurementItem[]
  projectId: string
  scheduleId: string
  studioId: string
  onItemOpen: (item: ProcurementItem) => void
  onItemArchive: (itemId: string) => void
  onItemDelete: (itemId: string) => void
  onItemFlag: (item: ProcurementItem) => void
  onDragEnd: (groupName: string, event: DragEndEvent, items: ProcurementItem[]) => void
  onQuickAdd: (groupName: string, name: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [quickAddName, setQuickAddName] = useState("")
  const groupTotal = items.reduce((sum, i) => sum + i.total_cost, 0)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 py-2 cursor-pointer" onClick={() => setCollapsed((v) => !v)}>
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span className="font-medium text-sm">{groupName}</span>
        <span className="text-xs text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""} · {formatINR(groupTotal)}
        </span>
      </div>

      {!collapsed && (
        <>
          <div className="border rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onDragEnd(groupName, event, items)}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No items in this group
                  </div>
                ) : (
                  items.map((item) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      onOpen={onItemOpen}
                      onArchive={onItemArchive}
                      onDelete={onItemDelete}
                      onFlag={onItemFlag}
                    />
                  ))
                )}
              </SortableContext>
            </DndContext>

            {/* Quick add row */}
            <div className="border-t px-2 py-1.5">
              <Input
                placeholder="Quick add item — press Enter"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickAddName.trim()) {
                    onQuickAdd(groupName, quickAddName.trim())
                    setQuickAddName("")
                  }
                }}
                className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Add from URL Sheet ───────────────────────────────────────────────────────

function AddFromUrlSheet({
  open,
  onOpenChange,
  onExtracted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onExtracted: (data: Record<string, unknown>) => void
}) {
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleExtract() {
    if (!url.trim()) return
    setLoading(true)
    try {
      const data = await enrichItemFromUrl(url.trim())
      onExtracted(data as Record<string, unknown>)
      onOpenChange(false)
      toast({ title: "Product details extracted" })
    } catch (err) {
      toast({
        title: "Extraction failed",
        description: err instanceof Error ? err.message : "Could not extract product details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add from URL</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-6">
          <p className="text-sm text-muted-foreground">
            Paste a product URL and we&apos;ll extract the details automatically.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExtract()}
              className="focus-visible:ring-[#e94560]"
            />
            <Button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className="bg-[#e94560] hover:bg-[#c73652] text-white shrink-0"
            >
              {loading ? "Extracting…" : "Extract"}
            </Button>
          </div>
          {loading && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Extracting product details…</p>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleDetail({
  schedule,
  projectId,
  studioId,
  userRole,
  currentUserId,
  onBack,
  onScheduleUpdate,
}: ScheduleDetailProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [localSchedule, setLocalSchedule] = useState(schedule)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(schedule.name)
  const [selectedItem, setSelectedItem] = useState<ProcurementItem | null>(null)
  const [newItemDefaults, setNewItemDefaults] = useState<Record<string, unknown> | null>(null)
  const [addFromUrlOpen, setAddFromUrlOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [addingGroup, setAddingGroup] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const canManage = userRole === "owner" || userRole === "senior_designer" || userRole === "designer"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getItems(schedule.id)
      setItems(data)
    } catch {
      toast({ title: "Failed to load items", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [schedule.id, toast])

  useEffect(() => { load() }, [load])

  async function saveName() {
    if (!nameVal.trim() || nameVal === localSchedule.name) { setEditingName(false); return }
    try {
      await updateSchedule(localSchedule.id, { name: nameVal.trim() })
      const updated = { ...localSchedule, name: nameVal.trim() }
      setLocalSchedule(updated)
      onScheduleUpdate(updated)
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" })
      setNameVal(localSchedule.name)
    } finally {
      setEditingName(false)
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateSchedule(localSchedule.id, { status: status as ProcurementSchedule["status"] })
      const updated = { ...localSchedule, status: status as ProcurementSchedule["status"] }
      setLocalSchedule(updated)
      onScheduleUpdate(updated)
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" })
    }
  }

  async function handleViewToggle() {
    const newView: ViewType = localSchedule.view_type === "room_based" ? "schedule_based" : "room_based"
    try {
      await updateSchedule(localSchedule.id, { view_type: newView })
      const updated: ProcurementSchedule = { ...localSchedule, view_type: newView }
      setLocalSchedule(updated)
      onScheduleUpdate(updated)
    } catch {
      toast({ title: "Failed to update view", variant: "destructive" })
    }
  }

  async function handleQuickAdd(groupName: string, name: string) {
    try {
      const item = await createItem({
        scheduleId: schedule.id,
        projectId,
        name,
        roomOrCategory: groupName === "Uncategorised" ? undefined : groupName,
      })
      setItems((prev) => [...prev, item])
      setSelectedItem(item)
      toast({ title: "Item created" })
    } catch {
      toast({ title: "Failed to create item", variant: "destructive" })
    }
  }

  async function handleAddItem(groupName?: string) {
    try {
      const item = await createItem({
        scheduleId: schedule.id,
        projectId,
        name: "New Item",
        roomOrCategory: groupName && groupName !== "Uncategorised" ? groupName : undefined,
        ...newItemDefaults,
      })
      setItems((prev) => [...prev, item])
      setSelectedItem(item)
      setNewItemDefaults(null)
    } catch {
      toast({ title: "Failed to create item", variant: "destructive" })
    }
  }

  async function handleArchiveItem(itemId: string) {
    try {
      await archiveItem(itemId)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      toast({ title: "Item archived" })
    } catch {
      toast({ title: "Failed to archive item", variant: "destructive" })
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteItem(itemId)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      toast({ title: "Item deleted" })
    } catch {
      toast({ title: "Failed to delete item", variant: "destructive" })
    }
  }

  async function handleFlagItem(item: ProcurementItem) {
    try {
      await updateItem(item.id, { is_flagged: !item.is_flagged })
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_flagged: !i.is_flagged } : i))
    } catch {
      toast({ title: "Failed to update flag", variant: "destructive" })
    }
  }

  async function handleDragEnd(groupName: string, event: DragEndEvent, groupItems: ProcurementItem[]) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = groupItems.findIndex((i) => i.id === active.id)
    const newIndex = groupItems.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(groupItems, oldIndex, newIndex)

    // Update local state optimistically
    const grouped = groupItems_by(items)
    grouped[groupName] = reordered
    const newItems: ProcurementItem[] = []
    for (const g of Object.keys(grouped)) newItems.push(...grouped[g])
    setItems(newItems)

    try {
      await reorderItems(schedule.id, reordered.map((i) => i.id))
    } catch {
      toast({ title: "Failed to reorder items", variant: "destructive" })
      load()
    }
  }

  function groupItems_by(itemList: ProcurementItem[]): Record<string, ProcurementItem[]> {
    return groupItems(itemList)
  }

  function handleUrlExtracted(data: Record<string, unknown>) {
    setNewItemDefaults(data)
    handleAddItem()
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return
    try {
      const item = await createItem({
        scheduleId: schedule.id,
        projectId,
        name: "New Item",
        roomOrCategory: newGroupName.trim(),
      })
      setItems((prev) => [...prev, item])
      setSelectedItem(item)
      setNewGroupName("")
      setAddingGroup(false)
    } catch {
      toast({ title: "Failed to add group", variant: "destructive" })
    }
  }

  const grouped = groupItems(items)
  const statusMeta = STATUS_BADGE[localSchedule.status] ?? STATUS_BADGE.draft

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Schedules</span>
          </button>
          <span className="text-muted-foreground">/</span>
          {editingName ? (
            <Input
              ref={nameInputRef}
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName()
                if (e.key === "Escape") { setEditingName(false); setNameVal(localSchedule.name) }
              }}
              className="h-7 font-semibold text-base w-48 focus-visible:ring-[#e94560]"
            />
          ) : (
            <button
              className="font-semibold text-base hover:text-[#e94560] transition-colors"
              onClick={() => { if (canManage) setEditingName(true) }}
            >
              {localSchedule.name}
            </button>
          )}

          {/* Status dropdown */}
          <Select value={localSchedule.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 text-xs w-auto border-0 shadow-none focus:ring-0 p-0">
              <Badge className={`text-xs px-2 py-0.5 cursor-pointer ${statusMeta.className}`}>
                {statusMeta.label}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_BADGE).map(([val, meta]) => (
                <SelectItem key={val} value={val}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Add item dropdown */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-[#e94560] hover:bg-[#c73652] text-white">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAddItem()}>
                  Manual Entry
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddFromUrlOpen(true)}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Add from URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* View toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewToggle}
            className="text-xs"
          >
            {localSchedule.view_type === "room_based" ? "Room View" : "Schedule View"}
          </Button>

          {/* Share */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>

          {/* Export PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/procurement/pdf?scheduleId=${schedule.id}`, "_blank")}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-12 w-full mb-2" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          {Object.keys(grouped).length === 0 ? (
            <div className="border border-dashed rounded-lg p-12 flex flex-col items-center gap-3 text-center">
              <Package className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">No items yet</p>
              {canManage && (
                <Button
                  size="sm"
                  className="bg-[#e94560] hover:bg-[#c73652] text-white"
                  onClick={() => handleAddItem()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add first item
                </Button>
              )}
            </div>
          ) : (
            <>
              {Object.entries(grouped).map(([groupName, groupItems]) => (
                <GroupSection
                  key={groupName}
                  groupName={groupName}
                  items={groupItems}
                  projectId={projectId}
                  scheduleId={schedule.id}
                  studioId={studioId}
                  onItemOpen={(item) => setSelectedItem(item)}
                  onItemArchive={handleArchiveItem}
                  onItemDelete={handleDeleteItem}
                  onItemFlag={handleFlagItem}
                  onDragEnd={handleDragEnd}
                  onQuickAdd={handleQuickAdd}
                />
              ))}

              {/* Add group */}
              {canManage && (
                <div className="mt-2">
                  {addingGroup ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        placeholder="Group name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddGroup()
                          if (e.key === "Escape") setAddingGroup(false)
                        }}
                        onBlur={() => { if (!newGroupName.trim()) setAddingGroup(false) }}
                        className="h-7 text-sm w-48 focus-visible:ring-[#e94560]"
                      />
                      <Button size="sm" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                        Add Group
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      onClick={() => setAddingGroup(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Group
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Item Detail Panel */}
      {selectedItem && (
        <ItemDetailPanel
          open={!!selectedItem}
          onOpenChange={(open) => { if (!open) { setSelectedItem(null); load() } }}
          item={selectedItem}
          projectId={projectId}
          studioId={studioId}
          userRole={userRole}
        />
      )}

      {/* Add from URL sheet */}
      <AddFromUrlSheet
        open={addFromUrlOpen}
        onOpenChange={setAddFromUrlOpen}
        onExtracted={handleUrlExtracted}
      />

      {/* Share panel */}
      {shareOpen && (
        <ScheduleSharePanel
          open={shareOpen}
          onOpenChange={setShareOpen}
          schedule={localSchedule}
          onRefresh={() => {}}
        />
      )}
    </div>
  )
}
