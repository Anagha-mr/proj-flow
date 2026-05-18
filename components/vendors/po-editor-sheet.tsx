"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"
import { createPurchaseOrder } from "@/app/actions/purchase-orders"
import type { Vendor } from "@/app/actions/vendors"
import type { PurchaseOrder, POLineItem } from "@/app/actions/purchase-orders"
import { formatCurrency } from "@/components/vendors/vendor-utils"
import { useToast } from "@/hooks/use-toast"

const GST_RATES = [0, 5, 12, 18, 28]

type LineItemForm = Omit<POLineItem, 'gst_amount' | 'line_total'>

interface POEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendors: Vendor[]
  projects: Array<{ id: string; name: string; address_line1: string | null }>
  onSaved: (po: PurchaseOrder) => void
}

function emptyLine(): LineItemForm {
  return { procurement_item_id: null, name: '', product_code: null, quantity: 1, unit: null, unit_price: 0, gst_rate: 18 }
}

function computeTotals(lines: LineItemForm[]) {
  let subtotal = 0
  let gstTotal = 0
  for (const l of lines) {
    const s = l.unit_price * l.quantity
    const g = Math.round(s * l.gst_rate / 100)
    subtotal += s
    gstTotal += g
  }
  return { subtotal, gstTotal, grandTotal: subtotal + gstTotal }
}

export function POEditorSheet({ open, onOpenChange, vendors, projects, onSaved }: POEditorSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [depositDate, setDepositDate] = useState("")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [balanceDate, setBalanceDate] = useState("")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [lines, setLines] = useState<LineItemForm[]>([emptyLine()])

  // Auto-fill delivery address from project
  useEffect(() => {
    const project = projects.find((p) => p.id === projectId)
    if (project?.address_line1) setDeliveryAddress(project.address_line1)
  }, [projectId, projects])

  const { subtotal, gstTotal, grandTotal } = computeTotals(lines)

  function updateLine(idx: number, field: keyof LineItemForm, value: unknown) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!projectId) { toast({ title: "Select a project", variant: "destructive" }); return }
    if (!vendorId) { toast({ title: "Select a vendor", variant: "destructive" }); return }
    if (lines.length === 0 || lines.every((l) => !l.name.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" }); return
    }

    setSaving(true)
    try {
      const po = await createPurchaseOrder({
        project_id: projectId,
        vendor_id: vendorId,
        line_items: lines.filter((l) => l.name.trim()),
        delivery_address: deliveryAddress || undefined,
        expected_delivery_date: expectedDelivery || undefined,
        payment_terms: {
          deposit_amount: depositAmount ? Number(depositAmount) : undefined,
          deposit_due_date: depositDate || undefined,
          balance_amount: balanceAmount ? Number(balanceAmount) : undefined,
          balance_due_date: balanceDate || undefined,
        },
        special_instructions: specialInstructions || undefined,
      })
      onSaved(po)
      onOpenChange(false)
      toast({ title: "Purchase order created" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Purchase Order</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          {/* Step 1 — Context */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Step 1 — Context</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Project <span className="text-red-500">*</span></Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Vendor <span className="text-red-500">*</span></Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.filter((v) => v.is_active).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 2 — Line items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Step 2 — Line Items</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 pr-2 min-w-[140px]">Item</th>
                    <th className="pb-2 pr-2 w-16">Qty</th>
                    <th className="pb-2 pr-2 w-16">Unit</th>
                    <th className="pb-2 pr-2 w-24">Unit Price ₹</th>
                    <th className="pb-2 pr-2 w-20">GST %</th>
                    <th className="pb-2 pr-2 w-24 text-right">Total</th>
                    <th className="pb-2 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const lineTotal = line.unit_price * line.quantity + Math.round(line.unit_price * line.quantity * line.gst_rate / 100)
                    return (
                      <tr key={idx} className="border-b">
                        <td className="py-2 pr-2">
                          <Input value={line.name} onChange={(e) => updateLine(idx, 'name', e.target.value)} placeholder="Item name" className="h-8 text-xs" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value) || 1)} className="h-8 text-xs" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input value={line.unit ?? ""} onChange={(e) => updateLine(idx, 'unit', e.target.value || null)} placeholder="sqft" className="h-8 text-xs" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input type="number" min={0} value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value) || 0)} className="h-8 text-xs" />
                        </td>
                        <td className="py-2 pr-2">
                          <Select value={String(line.gst_rate)} onValueChange={(v) => updateLine(idx, 'gst_rate', Number(v))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 pr-2 text-right text-muted-foreground text-xs">{formatCurrency(lineTotal)}</td>
                        <td className="py-2">
                          <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
            </Button>

            {/* Totals */}
            <div className="flex flex-col items-end gap-1 mt-3 text-sm">
              <div className="flex gap-8"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex gap-8"><span className="text-muted-foreground">GST Total</span><span>{formatCurrency(gstTotal)}</span></div>
              <div className="flex gap-8 font-semibold border-t pt-1"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
            </div>
          </div>

          {/* Step 3 — Delivery & terms */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Step 3 — Delivery &amp; Terms</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Delivery Address</Label>
                <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Deposit Amount ₹</Label>
                  <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Deposit Due Date</Label>
                  <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Balance Amount ₹</Label>
                  <Input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Balance Due Date</Label>
                  <Input type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Special Instructions</Label>
                <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} rows={2} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button onClick={handleSave} disabled={saving} className="bg-[#e94560] hover:bg-[#c73652] flex-1">
            {saving ? "Saving…" : "Create Purchase Order"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
