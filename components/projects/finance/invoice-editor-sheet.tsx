"use client"

import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Trash2, Plus } from "lucide-react"
import { updateInvoice, type Invoice, type LineItem } from "@/app/actions/finance"
import { INVOICE_UNITS } from "@/lib/constants"
import { computeGst } from "@/lib/gst"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: "Draft",   className: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    className: "bg-blue-100 text-blue-700" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700" },
  paid:    { label: "Paid",    className: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700" },
}

const GST_RATES = [0, 5, 12, 18, 28]

function emptyLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsn_code: "",
    quantity: 0,
    unit: "",
    unit_rate: 0,
    amount: 0,
    gst_rate: 18,
    cgst: 0,
    sgst: 0,
    igst: 0,
  }
}

function validateLineItems(items: LineItem[]): string | null {
  for (const item of items) {
    const label = item.description || "A line item"
    if (!item.quantity || item.quantity <= 0) {
      return `${label} needs a quantity greater than 0`
    }
    if (!item.unit) {
      return `${label} needs a unit selected`
    }
  }
  return null
}

interface InvoiceEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  studioStateCode: string
  clientStateCode: string
  onRefresh: () => void
  onSend: (inv: Invoice) => void
}

export function InvoiceEditorSheet({
  open,
  onOpenChange,
  invoice,
  studioStateCode,
  clientStateCode,
  onRefresh,
  onSend,
}: InvoiceEditorSheetProps) {
  const { toast } = useToast()
  const isIntraState = studioStateCode === clientStateCode

  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice.line_items.length > 0 ? invoice.line_items : [emptyLineItem()]
  )
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "")
  const [issueDate, setIssueDate] = useState(invoice.issue_date)
  const [notes, setNotes] = useState(invoice.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [sendConfirm, setSendConfirm] = useState(false)

  const updateItem = useCallback(
    (id: string, field: keyof LineItem, raw: string | number) => {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          const updated = { ...item, [field]: raw }
          // Recompute line total (quantity × rate) and GST whenever any of the
          // three inputs feeding them changes.
          if (field === "quantity" || field === "unit_rate" || field === "gst_rate") {
            const quantity = field === "quantity" ? Number(raw) : item.quantity
            const unitRate = field === "unit_rate" ? Number(raw) : item.unit_rate
            const gstRate = field === "gst_rate" ? Number(raw) : item.gst_rate
            const amount = unitRate * quantity
            const { cgst, sgst, igst } = computeGst(studioStateCode, clientStateCode, amount, gstRate)
            return { ...updated, quantity, unit_rate: unitRate, gst_rate: gstRate, amount, cgst, sgst, igst }
          }
          return updated
        })
      )
    },
    [studioStateCode, clientStateCode]
  )

  function addRow() {
    setLineItems((prev) => [...prev, emptyLineItem()])
  }

  function removeRow(id: string) {
    setLineItems((prev) => prev.filter((i) => i.id !== id))
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0)
  const totalCgst = lineItems.reduce((sum, i) => sum + i.cgst, 0)
  const totalSgst = lineItems.reduce((sum, i) => sum + i.sgst, 0)
  const totalIgst = lineItems.reduce((sum, i) => sum + i.igst, 0)
  const gstAmount = totalCgst + totalSgst + totalIgst
  const total = subtotal + gstAmount

  async function handleSave() {
    const validationError = validateLineItems(lineItems)
    if (validationError) {
      toast({ title: validationError, variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await updateInvoice(invoice.id, {
        lineItems,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        issueDate,
      })
      toast({ title: "Invoice saved" })
      onRefresh()
      onOpenChange(false)
    } catch {
      toast({ title: "Failed to save invoice", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndSend() {
    const validationError = validateLineItems(lineItems)
    if (validationError) {
      toast({ title: validationError, variant: "destructive" })
      setSendConfirm(false)
      return
    }
    // Save first then trigger send via parent
    setSaving(true)
    try {
      const updated = await updateInvoice(invoice.id, {
        lineItems,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        issueDate,
      })
      onRefresh()
      onSend({ ...invoice, ...updated })
    } catch {
      toast({ title: "Failed to save invoice", variant: "destructive" })
    } finally {
      setSaving(false)
      setSendConfirm(false)
    }
  }

  const statusMeta = STATUS_META[invoice.status] ?? STATUS_META.draft

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[640px] overflow-y-auto flex flex-col"
        >
          <SheetHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <SheetTitle>{invoice.invoice_number}</SheetTitle>
              <Badge className={`text-xs px-2 py-0.5 ${statusMeta.className}`}>
                {statusMeta.label}
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-5 mt-4 flex-1">
            {/* Dates row */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="text-sm focus-visible:ring-[#e94560]"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-sm focus-visible:ring-[#e94560]"
                />
              </div>
            </div>

            {/* GST regime indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  isIntraState
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {isIntraState ? "Intra-state: CGST + SGST" : "Inter-state: IGST"}
              </span>
            </div>

            {/* Line Items */}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground border-b">
                    <th className="text-left pb-2 pr-2 w-[22%]">Description</th>
                    <th className="text-left pb-2 pr-2 w-[8%]">HSN</th>
                    <th className="text-right pb-2 pr-2 w-[7%]">Qty</th>
                    <th className="text-left pb-2 pr-2 w-[9%]">Unit</th>
                    <th className="text-right pb-2 pr-2 w-[9%]">Rate ₹</th>
                    <th className="text-right pb-2 pr-2 w-[10%]">Amount ₹</th>
                    <th className="text-right pb-2 pr-2 w-[7%]">GST %</th>
                    {isIntraState ? (
                      <>
                        <th className="text-right pb-2 pr-2 w-[8%]">CGST</th>
                        <th className="text-right pb-2 pr-2 w-[8%]">SGST</th>
                      </>
                    ) : (
                      <th className="text-right pb-2 pr-2 w-[16%]">IGST</th>
                    )}
                    <th className="w-[5%]" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-1 pr-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Description"
                          className="h-7 text-xs border-0 focus-visible:border focus-visible:border-[#e94560] focus-visible:ring-0 px-1"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          value={item.hsn_code}
                          onChange={(e) => updateItem(item.id, "hsn_code", e.target.value)}
                          placeholder="HSN"
                          className="h-7 text-xs border-0 focus-visible:border focus-visible:border-[#e94560] focus-visible:ring-0 px-1"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 text-xs border-0 focus-visible:border focus-visible:border-[#e94560] focus-visible:ring-0 px-1 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <Select
                          value={item.unit}
                          onValueChange={(v) => updateItem(item.id, "unit", v)}
                        >
                          <SelectTrigger className="h-7 text-xs border-0 focus:ring-[#e94560] focus:ring-1 px-1">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {INVOICE_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.unit_rate || ""}
                          onChange={(e) => updateItem(item.id, "unit_rate", parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 text-xs border-0 focus-visible:border focus-visible:border-[#e94560] focus-visible:ring-0 px-1 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2 text-right text-xs">
                        {formatINR(item.amount)}
                      </td>
                      <td className="py-1 pr-2">
                        <Select
                          value={String(item.gst_rate)}
                          onValueChange={(v) => updateItem(item.id, "gst_rate", parseInt(v))}
                        >
                          <SelectTrigger className="h-7 text-xs border-0 focus:ring-[#e94560] focus:ring-1 px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map((r) => (
                              <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {isIntraState ? (
                        <>
                          <td className="py-1 pr-2 text-right text-xs text-muted-foreground">
                            {formatINR(item.cgst)}
                          </td>
                          <td className="py-1 pr-2 text-right text-xs text-muted-foreground">
                            {formatINR(item.sgst)}
                          </td>
                        </>
                      ) : (
                        <td className="py-1 pr-2 text-right text-xs text-muted-foreground">
                          {formatINR(item.igst)}
                        </td>
                      )}
                      <td className="py-1 text-center">
                        <button
                          onClick={() => removeRow(item.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Line Item */}
            <Button variant="ghost" size="sm" className="self-start text-xs" onClick={addRow}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Line Item
            </Button>

            {/* Totals panel */}
            <div className="border rounded-lg p-4 bg-muted/30 self-end w-full sm:w-72 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {isIntraState ? (
                <>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatINR(totalCgst)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatINR(totalSgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatINR(totalIgst)}</span>
                </div>
              )}
              <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Payment terms, bank details reminder…"
                className="text-sm focus-visible:ring-[#e94560]"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Draft"}
              </Button>
              {invoice.status === "draft" && (
                <Button
                  className="flex-1 bg-[#e94560] hover:bg-[#c73652] text-white"
                  onClick={() => setSendConfirm(true)}
                  disabled={saving}
                >
                  Send Invoice
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Send confirm from editor */}
      <Dialog open={sendConfirm} onOpenChange={setSendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save changes and send invoice{" "}
            <span className="font-medium text-foreground">{invoice.invoice_number}</span> to the
            client via email and WhatsApp?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirm(false)}>Cancel</Button>
            <Button
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={handleSaveAndSend}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
