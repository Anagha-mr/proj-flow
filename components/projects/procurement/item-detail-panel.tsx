"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Flag, Package, ExternalLink, Trash2, Archive } from "lucide-react"
import { updateItem, updateItemStatus, deleteItem, archiveItem, type ProcurementItem, type CurationStatus, type ClientApprovalStatus, type ProcurementStatus, type PaymentStatus } from "@/app/actions/procurement"
import { useToast } from "@/hooks/use-toast"

interface ItemDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ProcurementItem
  projectId: string
  studioId: string
  userRole: string
}

type SaveState = "idle" | "saving" | "saved"

// Status colour maps
const CURATION_COLOURS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  hidden: "bg-gray-100 text-gray-500",
  quoting: "bg-amber-100 text-amber-700",
  selected: "bg-blue-100 text-blue-700",
  internal_review: "bg-orange-100 text-orange-700",
  internally_approved: "bg-green-100 text-green-700",
}
const CLIENT_COLOURS: Record<string, string> = {
  client_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  resubmit: "bg-orange-100 text-orange-700",
  closed: "bg-slate-100 text-slate-600",
}
const PROCUREMENT_COLOURS: Record<string, string> = {
  ordered: "bg-blue-100 text-blue-700",
  in_production: "bg-amber-100 text-amber-700",
  in_transit: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  installed: "bg-teal-100 text-teal-700",
}
const PAYMENT_COLOURS: Record<string, string> = {
  invoiced: "bg-slate-100 text-slate-600",
  payment_due: "bg-amber-100 text-amber-700",
  partial_payment: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

export function ItemDetailPanel({ open, onOpenChange, item, studioId, userRole }: ItemDetailPanelProps) {
  const { toast } = useToast()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Item fields
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? "")
  const [brand, setBrand] = useState(item.brand ?? "")
  const [productCode, setProductCode] = useState(item.product_code ?? "")
  const [supplierName, setSupplierName] = useState(item.supplier_name ?? "")
  const [sourceUrl, setSourceUrl] = useState(item.source_url ?? "")
  const [dimLength, setDimLength] = useState(item.dimensions_length?.toString() ?? "")
  const [dimHeight, setDimHeight] = useState(item.dimensions_height?.toString() ?? "")
  const [dimDepth, setDimDepth] = useState(item.dimensions_depth?.toString() ?? "")
  const [dimUnit, setDimUnit] = useState(item.dimensions_unit ?? "mm")
  const [finish, setFinish] = useState(item.finish ?? "")
  const [material, setMaterial] = useState(item.material ?? "")
  const [quantity, setQuantity] = useState(item.quantity.toString())
  const [unitCost, setUnitCost] = useState(item.unit_cost.toString())
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "")
  const [isFlagged, setIsFlagged] = useState(item.is_flagged)
  const [inStock, setInStock] = useState(item.in_stock ?? false)

  // Status fields
  const [curationStatus, setCurationStatus] = useState<CurationStatus>(item.status?.curation_status ?? "draft")
  const [clientApprovalStatus, setClientApprovalStatus] = useState<ClientApprovalStatus>(item.status?.client_approval_status ?? "client_review")
  const [procurementStatus, setProcurementStatus] = useState<ProcurementStatus>(item.status?.procurement_status ?? "ordered")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(item.status?.payment_status ?? "invoiced")

  const computedTotal = (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0)

  const triggerSave = useCallback(async (
    itemUpdates: Partial<ProcurementItem>,
    statusUpdates?: Record<string, string>
  ) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaveState("saving")
    try {
      if (Object.keys(itemUpdates).length > 0) {
        await updateItem(item.id, itemUpdates)
      }
      if (statusUpdates && Object.keys(statusUpdates).length > 0) {
        await updateItemStatus(item.id, statusUpdates as Parameters<typeof updateItemStatus>[1])
      }
      setSaveState("saved")
      saveTimeout.current = setTimeout(() => setSaveState("idle"), 2000)
    } catch {
      setSaveState("idle")
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }, [item.id, toast])

  // Auto-save on blur handlers
  function onBlurName() { if (name !== item.name) triggerSave({ name }) }
  function onBlurDescription() { if (description !== (item.description ?? "")) triggerSave({ description }) }
  function onBlurBrand() { if (brand !== (item.brand ?? "")) triggerSave({ brand }) }
  function onBlurProductCode() { if (productCode !== (item.product_code ?? "")) triggerSave({ product_code: productCode }) }
  function onBlurSupplierName() { if (supplierName !== (item.supplier_name ?? "")) triggerSave({ supplier_name: supplierName }) }
  function onBlurSourceUrl() { if (sourceUrl !== (item.source_url ?? "")) triggerSave({ source_url: sourceUrl }) }
  function onBlurDimensions() {
    triggerSave({
      dimensions_length: dimLength ? parseFloat(dimLength) : null,
      dimensions_height: dimHeight ? parseFloat(dimHeight) : null,
      dimensions_depth: dimDepth ? parseFloat(dimDepth) : null,
      dimensions_unit: dimUnit,
    })
  }
  function onBlurFinish() { if (finish !== (item.finish ?? "")) triggerSave({ finish }) }
  function onBlurMaterial() { if (material !== (item.material ?? "")) triggerSave({ material }) }
  function onBlurQuantity() {
    const q = parseFloat(quantity) || 1
    if (q !== item.quantity) triggerSave({ quantity: q })
  }
  function onBlurUnitCost() {
    const c = parseFloat(unitCost) || 0
    if (c !== item.unit_cost) triggerSave({ unit_cost: c })
  }
  function onBlurImageUrl() { if (imageUrl !== (item.image_url ?? "")) triggerSave({ image_url: imageUrl }) }

  async function handleSave() {
    try {
      await updateItem(item.id, {
        name,
        description: description || null,
        brand: brand || null,
        product_code: productCode || null,
        supplier_name: supplierName || null,
        source_url: sourceUrl || null,
        dimensions_length: dimLength ? parseFloat(dimLength) : null,
        dimensions_height: dimHeight ? parseFloat(dimHeight) : null,
        dimensions_depth: dimDepth ? parseFloat(dimDepth) : null,
        dimensions_unit: dimUnit,
        finish: finish || null,
        material: material || null,
        quantity: parseFloat(quantity) || 1,
        unit_cost: parseFloat(unitCost) || 0,
        image_url: imageUrl || null,
        is_flagged: isFlagged,
        in_stock: inStock,
      })
      await updateItemStatus(item.id, {
        curation_status: curationStatus as Parameters<typeof updateItemStatus>[1]["curation_status"],
        client_approval_status: clientApprovalStatus as Parameters<typeof updateItemStatus>[1]["client_approval_status"],
        procurement_status: procurementStatus as Parameters<typeof updateItemStatus>[1]["procurement_status"],
        payment_status: paymentStatus as Parameters<typeof updateItemStatus>[1]["payment_status"],
      })
      toast({ title: "Saved" })
      onOpenChange(false)
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }

  async function handleDelete() {
    try {
      await deleteItem(item.id)
      toast({ title: "Item deleted" })
      onOpenChange(false)
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }

  async function handleArchive() {
    try {
      await archiveItem(item.id)
      toast({ title: "Item archived" })
      onOpenChange(false)
    } catch {
      toast({ title: "Failed to archive", variant: "destructive" })
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between pr-8">
            <SheetTitle className="text-base">Item Details</SheetTitle>
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "✓ Saved"}
            </span>
          </SheetHeader>

          <div className="flex flex-col gap-5 mt-5 pb-6">
            {/* 1. Product Info */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Product Info
              </p>

              {/* Image */}
              <div className="mb-3">
                <label className="text-sm font-medium mb-1 block">Image URL</label>
                <div className="flex gap-2">
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onBlur={onBlurImageUrl}
                    placeholder="https://..."
                    className="focus-visible:ring-[#e94560] text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={onBlurName}
                    className="focus-visible:ring-[#e94560]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={onBlurDescription}
                    rows={2}
                    className="focus-visible:ring-[#e94560] text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Brand</label>
                    <Input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      onBlur={onBlurBrand}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Product Code</label>
                    <Input
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      onBlur={onBlurProductCode}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Supplier</label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    onBlur={onBlurSupplierName}
                    className="focus-visible:ring-[#e94560] text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Source URL</label>
                  <div className="flex gap-2">
                    <Input
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      onBlur={onBlurSourceUrl}
                      placeholder="https://..."
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="icon" className="shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* 2. Dimensions & Specs */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Dimensions & Specs
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">L</label>
                    <Input
                      type="number"
                      value={dimLength}
                      onChange={(e) => setDimLength(e.target.value)}
                      onBlur={onBlurDimensions}
                      placeholder="0"
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">H</label>
                    <Input
                      type="number"
                      value={dimHeight}
                      onChange={(e) => setDimHeight(e.target.value)}
                      onBlur={onBlurDimensions}
                      placeholder="0"
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">D</label>
                    <Input
                      type="number"
                      value={dimDepth}
                      onChange={(e) => setDimDepth(e.target.value)}
                      onBlur={onBlurDimensions}
                      placeholder="0"
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                    <Select value={dimUnit} onValueChange={(v) => { setDimUnit(v); onBlurDimensions() }}>
                      <SelectTrigger className="text-sm focus:ring-[#e94560]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["mm", "cm", "inches", "ft"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Finish</label>
                    <Input
                      value={finish}
                      onChange={(e) => setFinish(e.target.value)}
                      onBlur={onBlurFinish}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Material</label>
                    <Input
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      onBlur={onBlurMaterial}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* 3. Pricing */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Pricing
              </p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Quantity</label>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onBlur={onBlurQuantity}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Unit Cost ₹</label>
                    <Input
                      type="number"
                      min={0}
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      onBlur={onBlurUnitCost}
                      className="focus-visible:ring-[#e94560] text-sm"
                    />
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatINR(computedTotal)}</p>
                </div>
              </div>
            </section>

            <Separator />

            {/* 4. Status tracks */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Status
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Curation</label>
                  <Select
                    value={curationStatus}
                    onValueChange={(v) => {
                      const val = v as CurationStatus
                      setCurationStatus(val)
                      updateItemStatus(item.id, { curation_status: val })
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 focus:ring-[#e94560]">
                      <SelectValue>
                        <Badge className={`text-xs px-2 py-0 ${CURATION_COLOURS[curationStatus]}`}>
                          {curationStatus.replace("_", " ")}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURATION_COLOURS).map(([val, cls]) => (
                        <SelectItem key={val} value={val}>
                          <Badge className={`text-xs px-2 py-0 ${cls}`}>{val.replace(/_/g, " ")}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Client Approval</label>
                  <Select
                    value={clientApprovalStatus}
                    onValueChange={(v) => {
                      const val = v as ClientApprovalStatus
                      setClientApprovalStatus(val)
                      updateItemStatus(item.id, { client_approval_status: val })
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 focus:ring-[#e94560]">
                      <SelectValue>
                        <Badge className={`text-xs px-2 py-0 ${CLIENT_COLOURS[clientApprovalStatus]}`}>
                          {clientApprovalStatus.replace(/_/g, " ")}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLIENT_COLOURS).map(([val, cls]) => (
                        <SelectItem key={val} value={val}>
                          <Badge className={`text-xs px-2 py-0 ${cls}`}>{val.replace(/_/g, " ")}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Procurement</label>
                  <Select
                    value={procurementStatus}
                    onValueChange={(v) => {
                      const val = v as ProcurementStatus
                      setProcurementStatus(val)
                      updateItemStatus(item.id, { procurement_status: val })
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 focus:ring-[#e94560]">
                      <SelectValue>
                        <Badge className={`text-xs px-2 py-0 ${PROCUREMENT_COLOURS[procurementStatus]}`}>
                          {procurementStatus.replace(/_/g, " ")}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROCUREMENT_COLOURS).map(([val, cls]) => (
                        <SelectItem key={val} value={val}>
                          <Badge className={`text-xs px-2 py-0 ${cls}`}>{val.replace(/_/g, " ")}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Payment</label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(v) => {
                      const val = v as PaymentStatus
                      setPaymentStatus(val)
                      updateItemStatus(item.id, { payment_status: val })
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 focus:ring-[#e94560]">
                      <SelectValue>
                        <Badge className={`text-xs px-2 py-0 ${PAYMENT_COLOURS[paymentStatus]}`}>
                          {paymentStatus.replace(/_/g, " ")}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_COLOURS).map(([val, cls]) => (
                        <SelectItem key={val} value={val}>
                          <Badge className={`text-xs px-2 py-0 ${cls}`}>{val.replace(/_/g, " ")}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client comment */}
              {item.status?.client_comment && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">Client Comment</p>
                  <p className="text-sm text-amber-800 italic">{item.status.client_comment}</p>
                </div>
              )}
            </section>

            <Separator />

            {/* 5. Flags & Notes */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Flags & Notes
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className={`w-4 h-4 ${isFlagged ? "text-[#e94560]" : "text-muted-foreground"}`} />
                    <label className="text-sm font-medium">Flagged for review</label>
                  </div>
                  <Switch
                    checked={isFlagged}
                    onCheckedChange={(v) => {
                      setIsFlagged(v)
                      updateItem(item.id, { is_flagged: v })
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">In Stock</label>
                  <Switch
                    checked={inStock}
                    onCheckedChange={(v) => {
                      setInStock(v)
                      updateItem(item.id, { in_stock: v })
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={handleArchive}
                >
                  <Archive className="w-4 h-4 mr-1" />
                  Archive
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
              <Button
                className="bg-[#e94560] hover:bg-[#c73652] text-white"
                onClick={handleSave}
              >
                Save & Close
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete &quot;{item.name}&quot; and all its status data. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
