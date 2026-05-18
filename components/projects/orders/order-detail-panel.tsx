"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ExternalLink } from "lucide-react"
import type { OrderTrackingRow, CreateOrderInput, UpdateOrderInput } from "@/app/actions/orders"
import type { Vendor } from "@/app/actions/vendors"
import { createOrderTracking, updateOrderTracking, deleteOrderTracking } from "@/app/actions/orders"
import { formatCurrency } from "@/components/vendors/vendor-utils"
import { useToast } from "@/hooks/use-toast"

const NO_VENDOR = "__none__"

const ORDER_STATUSES = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'in_production', label: 'In Production' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'customs_hold', label: 'Customs Hold' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'installed', label: 'Installed' },
] as const

interface ProcurementItemOption {
  id: string
  name: string
  vendor_id: string | null
  image_url: string | null
  total_cost: number | null
}

interface OrderDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: OrderTrackingRow | null
  projectId: string
  untracked: ProcurementItemOption[]
  vendors: Vendor[]
  onSaved: (order: OrderTrackingRow) => void
  onDeleted: (id: string) => void
}

export function OrderDetailPanel({
  open, onOpenChange, order, projectId, untracked, vendors, onSaved, onDeleted
}: OrderDetailPanelProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isEdit = !!order

  const [itemId, setItemId] = useState(order?.procurement_item_id ?? "")
  const [vendorId, setVendorId] = useState(order?.vendor_id ?? "")
  const [orderNumber, setOrderNumber] = useState(order?.order_number ?? "")
  const [trackingLink, setTrackingLink] = useState(order?.tracking_link ?? "")
  const [shipmentNotes, setShipmentNotes] = useState(order?.shipment_notes ?? "")
  const [status, setStatus] = useState<OrderTrackingRow['status']>(order?.status ?? 'ordered')
  const [expectedDelivery, setExpectedDelivery] = useState(order?.expected_delivery_date ?? "")
  const [actualDelivery, setActualDelivery] = useState(order?.actual_delivery_date ?? "")
  const [clientDeposit, setClientDeposit] = useState(order?.client_deposit_paid?.toString() ?? "")
  const [clientDepositDate, setClientDepositDate] = useState(order?.client_deposit_paid_date ?? "")
  const [supplierDeposit, setSupplierDeposit] = useState(order?.supplier_deposit_paid?.toString() ?? "")
  const [supplierDepositDate, setSupplierDepositDate] = useState(order?.supplier_deposit_paid_date ?? "")
  const [clientBalance, setClientBalance] = useState(order?.client_balance_due?.toString() ?? "")
  const [clientBalanceDate, setClientBalanceDate] = useState(order?.client_balance_due_date ?? "")
  const [supplierBalance, setSupplierBalance] = useState(order?.supplier_balance_due?.toString() ?? "")
  const [supplierBalanceDate, setSupplierBalanceDate] = useState(order?.supplier_balance_due_date ?? "")

  // Reset form whenever the panel opens for a different order
  useEffect(() => {
    if (!open) return
    setItemId(order?.procurement_item_id ?? "")
    setVendorId(order?.vendor_id ?? "")
    setOrderNumber(order?.order_number ?? "")
    setTrackingLink(order?.tracking_link ?? "")
    setShipmentNotes(order?.shipment_notes ?? "")
    setStatus(order?.status ?? 'ordered')
    setExpectedDelivery(order?.expected_delivery_date ?? "")
    setActualDelivery(order?.actual_delivery_date ?? "")
    setClientDeposit(order?.client_deposit_paid?.toString() ?? "")
    setClientDepositDate(order?.client_deposit_paid_date ?? "")
    setSupplierDeposit(order?.supplier_deposit_paid?.toString() ?? "")
    setSupplierDepositDate(order?.supplier_deposit_paid_date ?? "")
    setClientBalance(order?.client_balance_due?.toString() ?? "")
    setClientBalanceDate(order?.client_balance_due_date ?? "")
    setSupplierBalance(order?.supplier_balance_due?.toString() ?? "")
    setSupplierBalanceDate(order?.supplier_balance_due_date ?? "")
  }, [open, order])

  // Auto-fill vendor from procurement item selection
  useEffect(() => {
    if (!isEdit && itemId) {
      const item = untracked.find((i) => i.id === itemId)
      if (item?.vendor_id) setVendorId(item.vendor_id)
    }
  }, [itemId, isEdit, untracked])

  async function handleSave() {
    setSaving(true)
    try {
      if (isEdit) {
        const updates: UpdateOrderInput = {
          vendor_id: vendorId || null,
          order_number: orderNumber || null,
          tracking_link: trackingLink || null,
          shipment_notes: shipmentNotes || null,
          status,
          expected_delivery_date: expectedDelivery || null,
          actual_delivery_date: actualDelivery || null,
          client_deposit_paid: clientDeposit ? Number(clientDeposit) : null,
          client_deposit_paid_date: clientDepositDate || null,
          supplier_deposit_paid: supplierDeposit ? Number(supplierDeposit) : null,
          supplier_deposit_paid_date: supplierDepositDate || null,
          client_balance_due: clientBalance ? Number(clientBalance) : null,
          client_balance_due_date: clientBalanceDate || null,
          supplier_balance_due: supplierBalance ? Number(supplierBalance) : null,
          supplier_balance_due_date: supplierBalanceDate || null,
        }
        const updated = await updateOrderTracking(order!.id, updates)
        onSaved(updated)
      } else {
        if (!itemId) { toast({ title: "Select a procurement item", variant: "destructive" }); setSaving(false); return }
        const input: CreateOrderInput = {
          project_id: projectId,
          procurement_item_id: itemId,
          vendor_id: vendorId || undefined,
          order_number: orderNumber || undefined,
          expected_delivery_date: expectedDelivery || undefined,
          status,
        }
        const created = await createOrderTracking(input)
        onSaved(created)
      }
      onOpenChange(false)
      toast({ title: isEdit ? "Order updated" : "Order tracking added" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!order || !confirm("Delete this order tracking record?")) return
    setDeleting(true)
    try {
      await deleteOrderTracking(order.id)
      onDeleted(order.id)
      onOpenChange(false)
      toast({ title: "Order tracking deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const linkedItem = !isEdit ? untracked.find((i) => i.id === itemId) : null
  const linkedVendor = vendors.find((v) => v.id === (vendorId || order?.vendor_id))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Order" : "Track Order"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          {/* Item selector (create mode only) */}
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label>Procurement Item <span className="text-red-500">*</span></Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger><SelectValue placeholder="Select item to track" /></SelectTrigger>
                <SelectContent>
                  {untracked.length === 0 ? (
                    <SelectItem value="__empty__" disabled>No untracked items</SelectItem>
                  ) : (
                    untracked.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section 1 — Order Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Order Info</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vendor</Label>
                <Select value={vendorId || NO_VENDOR} onValueChange={(v) => setVendorId(v === NO_VENDOR ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENDOR}>— None —</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Order Number</Label>
                  <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as OrderTrackingRow['status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Tracking Link</Label>
                <div className="flex gap-2">
                  <Input value={trackingLink} onChange={(e) => setTrackingLink(e.target.value)} className="flex-1" />
                  {trackingLink && (
                    <a href={trackingLink} target="_blank" rel="noopener noreferrer" className="flex items-center px-2 border rounded hover:bg-muted">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Expected Delivery</Label>
                  <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Actual Delivery</Label>
                  <Input type="date" value={actualDelivery} onChange={(e) => setActualDelivery(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Shipment Notes</Label>
                <Textarea value={shipmentNotes} onChange={(e) => setShipmentNotes(e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2 — Payment Tracking */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Payment Tracking</p>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Client Deposit Paid',   amount: clientDeposit,   setAmount: setClientDeposit,   date: clientDepositDate,   setDate: setClientDepositDate },
                { label: 'Supplier Deposit Paid', amount: supplierDeposit, setAmount: setSupplierDeposit, date: supplierDepositDate, setDate: setSupplierDepositDate },
                { label: 'Client Balance Due',    amount: clientBalance,   setAmount: setClientBalance,   date: clientBalanceDate,   setDate: setClientBalanceDate },
                { label: 'Supplier Balance Due',  amount: supplierBalance, setAmount: setSupplierBalance, date: supplierBalanceDate, setDate: setSupplierBalanceDate },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{row.label}</Label>
                    <Input
                      type="number"
                      placeholder="₹ Amount"
                      value={row.amount}
                      onChange={(e) => row.setAmount(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => row.setDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — Linked Item */}
          {isEdit && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Linked Item</p>
                <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
                  {order?.item_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.item_image_url} alt={order.item_name} className="w-14 h-14 rounded object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{order?.item_name}</p>
                    {order?.item_total_cost !== null && order?.item_total_cost !== undefined && (
                      <p className="text-xs text-muted-foreground">{formatCurrency(order.item_total_cost)}</p>
                    )}
                    {linkedVendor && (
                      <p className="text-xs text-muted-foreground">{linkedVendor.name}{linkedVendor.phone ? ` · ${linkedVendor.phone}` : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {!isEdit && linkedItem && (
            <>
              <Separator />
              <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
                {linkedItem.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={linkedItem.image_url} alt={linkedItem.name} className="w-14 h-14 rounded object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted" />
                )}
                <div>
                  <p className="font-medium text-sm">{linkedItem.name}</p>
                  {linkedItem.total_cost !== null && (
                    <p className="text-xs text-muted-foreground">{formatCurrency(linkedItem.total_cost)}</p>
                  )}
                  {linkedVendor && <p className="text-xs text-muted-foreground">{linkedVendor.name}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <Button onClick={handleSave} disabled={saving} className="bg-[#e94560] hover:bg-[#c73652] flex-1">
            {saving ? "Saving…" : "Save"}
          </Button>
          {isEdit && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
