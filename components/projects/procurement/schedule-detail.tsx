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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Share2,
  RefreshCw,
  Loader2,
} from "lucide-react"
import {
  getItems,
  createItem,
  updateSchedule,
  archiveItem,
  deleteItem,
  updateItem,
  reorderItems,
  type ProcurementSchedule,
  type ProcurementItem,
  type ViewType,
} from "@/app/actions/procurement"
import { refreshProductFromURL } from "@/app/actions/product-discovery"
import type { ExtractedProduct } from "@/app/actions/product-discovery"
import { URLAutofillInput } from "@/components/procurement/url-autofill-input"
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
  onRefreshFromUrl,
  isRefreshing,
}: {
  item: ProcurementItem
  onOpen: (item: ProcurementItem) => void
  onArchive: (itemId: string) => void
  onDelete: (itemId: string) => void
  onFlag: (item: ProcurementItem) => void
  onRefreshFromUrl: (item: ProcurementItem) => void
  isRefreshing: boolean
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

  // Use product_image_url (AI-extracted) first, fallback to image_url
  const thumbUrl = item.product_image_url || item.image_url

  const brandDimensions = [item.brand, item.dimensions].filter(Boolean).join(' · ')

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

      {/* Thumbnail — 40px desktop, 32px mobile */}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <Package className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Name + source URL indicator + brand/dimensions */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground transition-colors" />
            </a>
          )}
        </div>
        {brandDimensions ? (
          <p className="text-xs text-muted-foreground truncate">{brandDimensions}</p>
        ) : item.description ? (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
        ) : null}
      </div>

      {/* Brand column (desktop) */}
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
          {item.source_url && (
            <DropdownMenuItem
              onClick={() => onRefreshFromUrl(item)}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-2" />
              )}
              Update from URL
            </DropdownMenuItem>
          )}
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
  refreshingItemId,
  onItemOpen,
  onItemArchive,
  onItemDelete,
  onItemFlag,
  onItemRefreshFromUrl,
  onDragEnd,
  onQuickAdd,
}: {
  groupName: string
  items: ProcurementItem[]
  projectId: string
  scheduleId: string
  studioId: string
  refreshingItemId: string | null
  onItemOpen: (item: ProcurementItem) => void
  onItemArchive: (itemId: string) => void
  onItemDelete: (itemId: string) => void
  onItemFlag: (item: ProcurementItem) => void
  onItemRefreshFromUrl: (item: ProcurementItem) => void
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
                      onRefreshFromUrl={onItemRefreshFromUrl}
                      isRefreshing={refreshingItemId === item.id}
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

// ─── Add Item Sheet (URL autofill + manual form) ──────────────────────────────

function AddItemSheet({
  open,
  onOpenChange,
  scheduleId,
  projectId,
  onItemCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  scheduleId: string
  projectId: string
  onItemCreated: (item: ProcurementItem) => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [brand, setBrand] = useState("")
  const [materialFinish, setMaterialFinish] = useState("")
  const [dimensions, setDimensions] = useState("")
  const [description, setDescription] = useState("")
  const [productImageUrl, setProductImageUrl] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")

  // Track which fields were auto-filled for green border
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  function handleExtracted(product: ExtractedProduct) {
    const filled = new Set<string>()
    if (product.name) { setName(product.name); filled.add("name") }
    if (product.price !== null && product.price !== undefined) { setUnitCost(String(product.price)); filled.add("unitCost") }
    if (product.brand) { setBrand(product.brand); filled.add("brand") }
    if (product.material_finish) { setMaterialFinish(product.material_finish); filled.add("materialFinish") }
    if (product.dimensions) { setDimensions(product.dimensions); filled.add("dimensions") }
    if (product.description) { setDescription(product.description); filled.add("description") }
    if (product.image_url) { setProductImageUrl(product.image_url); filled.add("productImageUrl") }
    setSourceUrl(product.source_url)
    setAutoFilled(filled)
  }

  function handleClear() {
    setName("")
    setUnitCost("")
    setBrand("")
    setMaterialFinish("")
    setDimensions("")
    setDescription("")
    setProductImageUrl("")
    setSourceUrl("")
    setAutoFilled(new Set())
  }

  function clearAutoFill(field: string) {
    setAutoFilled(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  function autofillBorder(field: string) {
    return autoFilled.has(field)
      ? "border-l-2 border-[#1D9E75] transition-all duration-300"
      : "transition-all duration-300"
  }

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const item = await createItem({
        scheduleId,
        projectId,
        name: name.trim(),
        unitCost: unitCost ? parseFloat(unitCost) : 0,
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        sourceUrl: sourceUrl || undefined,
        productImageUrl: productImageUrl || undefined,
        materialFinish: materialFinish.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        lastUrlRefreshAt: sourceUrl ? new Date().toISOString() : undefined,
      })
      onItemCreated(item)
      onOpenChange(false)
      // Reset form
      handleClear()
      toast({ title: "Item added" })
    } catch (err) {
      toast({
        title: "Failed to add item",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Item</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-5 pb-6">
          {/* URL Autofill section */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quick Add from URL
            </p>
            <URLAutofillInput onExtracted={handleExtracted} onClear={handleClear} />
          </div>

          <div className="relative flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">or fill in manually</span>
            <Separator className="flex-1" />
          </div>

          {/* Product Image preview */}
          {productImageUrl && (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-[6px] bg-muted overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImageUrl}
                  alt="Product"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <button
                type="button"
                onClick={() => { setProductImageUrl(""); clearAutoFill("productImageUrl") }}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Remove
              </button>
            </div>
          )}

          {/* Form fields */}
          <div className="flex flex-col gap-3">
            <div className={autofillBorder("name")}>
              <label className="text-sm font-medium mb-1 block">Name *</label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); clearAutoFill("name") }}
                placeholder="Product name"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <div className={autofillBorder("unitCost")}>
              <label className="text-sm font-medium mb-1 block">Unit Cost ₹</label>
              <Input
                type="number"
                min={0}
                value={unitCost}
                onChange={(e) => { setUnitCost(e.target.value); clearAutoFill("unitCost") }}
                placeholder="0"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <div className={autofillBorder("brand")}>
              <label className="text-sm font-medium mb-1 block">Brand</label>
              <Input
                value={brand}
                onChange={(e) => { setBrand(e.target.value); clearAutoFill("brand") }}
                placeholder="e.g. Hafele, Grohe, Kohler"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <div className={autofillBorder("materialFinish")}>
              <label className="text-sm font-medium mb-1 block">Material / Finish</label>
              <Input
                value={materialFinish}
                onChange={(e) => { setMaterialFinish(e.target.value); clearAutoFill("materialFinish") }}
                placeholder="e.g. Brushed brass, Matte white ceramic"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <div className={autofillBorder("dimensions")}>
              <label className="text-sm font-medium mb-1 block">Dimensions</label>
              <Input
                value={dimensions}
                onChange={(e) => { setDimensions(e.target.value); clearAutoFill("dimensions") }}
                placeholder="e.g. 120cm × 60cm × 45cm"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <div className={autofillBorder("description")}>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearAutoFill("description") }}
                rows={2}
                placeholder="Brief product description"
                className="focus-visible:ring-[#e94560] text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-[#e94560] hover:bg-[#c73652] text-white w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding…
              </>
            ) : (
              "Add Item"
            )}
          </Button>
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
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [addingGroup, setAddingGroup] = useState(false)
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null)
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

  async function handleManualAdd(groupName?: string) {
    try {
      const item = await createItem({
        scheduleId: schedule.id,
        projectId,
        name: "New Item",
        roomOrCategory: groupName && groupName !== "Uncategorised" ? groupName : undefined,
      })
      setItems((prev) => [...prev, item])
      setSelectedItem(item)
    } catch {
      toast({ title: "Failed to create item", variant: "destructive" })
    }
  }

  function handleItemCreated(item: ProcurementItem) {
    setItems((prev) => [...prev, item])
    setSelectedItem(item)
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

  async function handleRefreshFromUrl(item: ProcurementItem) {
    setRefreshingItemId(item.id)
    try {
      const result = await refreshProductFromURL(item.id)
      if (result.success) {
        toast({ title: "Product details updated from source" })
        await load()
      } else {
        toast({ title: result.error ?? "Failed to update from URL", variant: "destructive" })
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update from URL",
        variant: "destructive",
      })
    } finally {
      setRefreshingItemId(null)
    }
  }

  async function handleDragEnd(groupName: string, event: DragEndEvent, groupItems: ProcurementItem[]) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = groupItems.findIndex((i) => i.id === active.id)
    const newIndex = groupItems.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(groupItems, oldIndex, newIndex)

    const grouped = groupItemsBy(items)
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

  function groupItemsBy(itemList: ProcurementItem[]): Record<string, ProcurementItem[]> {
    return groupItems(itemList)
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
                <DropdownMenuItem onClick={() => handleManualAdd()}>
                  Manual Entry
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddSheetOpen(true)}>
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
                  onClick={() => setAddSheetOpen(true)}
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
                  refreshingItemId={refreshingItemId}
                  onItemOpen={(item) => setSelectedItem(item)}
                  onItemArchive={handleArchiveItem}
                  onItemDelete={handleDeleteItem}
                  onItemFlag={handleFlagItem}
                  onItemRefreshFromUrl={handleRefreshFromUrl}
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

      {/* Add Item Sheet (URL autofill + form) */}
      <AddItemSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        scheduleId={schedule.id}
        projectId={projectId}
        onItemCreated={handleItemCreated}
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
