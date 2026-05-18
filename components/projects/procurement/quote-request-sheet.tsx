"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createQuoteRequest } from "@/app/actions/quotes"
import type { Vendor } from "@/app/actions/vendors"
import { useToast } from "@/hooks/use-toast"

interface ProcurementItemOption {
  id: string
  name: string
  curation_status: string | null
}

interface QuoteRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  items: ProcurementItemOption[]
  vendors: Vendor[]
  onCreated: () => void
}

const TYPE_LABELS: Record<string, string> = {
  furniture: 'Furniture', tiles: 'Tiles', lighting: 'Lighting',
  textiles: 'Textiles', sanitaryware: 'Sanitaryware', hardware: 'Hardware', other: 'Other',
}

export function QuoteRequestSheet({ open, onOpenChange, projectId, items, vendors, onCreated }: QuoteRequestSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [itemId, setItemId] = useState("")
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [specifications, setSpecifications] = useState("")
  const [leadTime, setLeadTime] = useState("")
  const [minQty, setMinQty] = useState("")
  const [logisticsNotes, setLogisticsNotes] = useState("")
  const [deadline, setDeadline] = useState("")

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id])
  }

  async function handleSend() {
    if (!itemId) { toast({ title: "Select a procurement item", variant: "destructive" }); return }
    if (selectedVendors.length === 0) { toast({ title: "Select at least one vendor", variant: "destructive" }); return }

    setSaving(true)
    try {
      await createQuoteRequest({
        project_id: projectId,
        procurement_item_id: itemId,
        vendor_ids: selectedVendors,
        specifications: specifications || undefined,
        required_lead_time_days: leadTime ? Number(leadTime) : undefined,
        min_order_qty: minQty ? Number(minQty) : undefined,
        logistics_notes: logisticsNotes || undefined,
        response_deadline: deadline || undefined,
      })
      onCreated()
      onOpenChange(false)
      toast({ title: `Quote request sent to ${selectedVendors.length} vendor${selectedVendors.length !== 1 ? 's' : ''}` })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const quotingItems = items.filter((i) => i.curation_status === 'quoting')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Request Quote</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Procurement Item <span className="text-red-500">*</span></Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Select item (status: Quoting)" /></SelectTrigger>
              <SelectContent>
                {quotingItems.length === 0 ? (
                  <SelectItem value="__none__" disabled>No items with status &apos;Quoting&apos;</SelectItem>
                ) : (
                  quotingItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Select Vendors <span className="text-red-500">*</span></Label>
            <div className="border rounded-lg p-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
              {vendors.filter((v) => v.is_active).map((vendor) => (
                <label key={vendor.id} className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={selectedVendors.includes(vendor.id)}
                    onCheckedChange={() => toggleVendor(vendor.id)}
                  />
                  <div>
                    <span className="text-sm font-medium">{vendor.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{TYPE_LABELS[vendor.type] ?? vendor.type}</span>
                  </div>
                </label>
              ))}
              {vendors.filter((v) => v.is_active).length === 0 && (
                <p className="text-xs text-muted-foreground">No active vendors. Add vendors first.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Specifications</Label>
            <Textarea value={specifications} onChange={(e) => setSpecifications(e.target.value)} rows={3} placeholder="Material specs, finishes, dimensions…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Required Lead Time (days)</Label>
              <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Min Order Quantity</Label>
              <Input type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Logistics Notes</Label>
            <Textarea value={logisticsNotes} onChange={(e) => setLogisticsNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Response Deadline</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button onClick={handleSend} disabled={saving} className="bg-[#e94560] hover:bg-[#c73652] flex-1">
            {saving ? "Sending…" : `Send Quote Request${selectedVendors.length > 0 ? ` (${selectedVendors.length})` : ''}`}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
