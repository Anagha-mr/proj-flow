"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { createVendor, updateVendor } from "@/app/actions/vendors"
import type { Vendor, CreateVendorInput } from "@/app/actions/vendors"
import { useToast } from "@/hooks/use-toast"

const VENDOR_TYPES = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'tiles', label: 'Tiles' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'textiles', label: 'Textiles' },
  { value: 'sanitaryware', label: 'Sanitaryware' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
] as const

interface AddEditVendorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor?: Vendor | null
  userRole: string
  onSaved: (vendor: Vendor) => void
}

export function AddEditVendorSheet({ open, onOpenChange, vendor, userRole, onSaved }: AddEditVendorSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)

  const [form, setForm] = useState<Partial<CreateVendorInput>>(() => vendor ? {
    name: vendor.name,
    type: vendor.type,
    type_custom: vendor.type_custom,
    contact_name: vendor.contact_name,
    phone: vendor.phone,
    email: vendor.email,
    whatsapp_number: vendor.whatsapp_number,
    showroom_address: vendor.showroom_address,
    gstin: vendor.gstin,
    bank_details: vendor.bank_details,
    default_lead_time_days: vendor.default_lead_time_days,
    notes: vendor.notes,
    preferred_categories: vendor.preferred_categories,
  } : {
    type: 'furniture',
    preferred_categories: [],
  })

  const isOwner = userRole === 'owner'

  function set(field: keyof CreateVendorInput, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function setBank(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      bank_details: { ...(prev.bank_details ?? { account_number: '', ifsc: '', bank_name: '', account_name: '' }), [field]: value },
    }))
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      toast({ title: "Vendor name is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      let saved: Vendor
      if (vendor) {
        saved = await updateVendor(vendor.id, form as Partial<CreateVendorInput>)
      } else {
        saved = await createVendor(form as CreateVendorInput)
      }
      onSaved(saved)
      onOpenChange(false)
      toast({ title: vendor ? "Vendor updated" : "Vendor created" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vendor ? "Edit Vendor" : "Add Vendor"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Vendor company name" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Type <span className="text-red-500">*</span></Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENDOR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.type === 'other' && (
            <div className="flex flex-col gap-1.5">
              <Label>Specify type</Label>
              <Input value={form.type_custom ?? ""} onChange={(e) => set("type_custom", e.target.value)} placeholder="e.g. Curtains" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Contact Name</Label>
            <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp_number ?? ""} onChange={(e) => set("whatsapp_number", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Showroom Address</Label>
            <Textarea value={form.showroom_address ?? ""} onChange={(e) => set("showroom_address", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>GSTIN</Label>
              <Input value={form.gstin ?? ""} onChange={(e) => set("gstin", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Default Lead Time (days)</Label>
              <Input
                type="number"
                value={form.default_lead_time_days ?? ""}
                onChange={(e) => set("default_lead_time_days", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          {isOwner && (
            <Collapsible open={bankOpen} onOpenChange={setBankOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full">
                <ChevronDown className={`w-4 h-4 transition-transform ${bankOpen ? "rotate-180" : ""}`} />
                Bank Details
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-3 pt-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Account Number</Label>
                    <Input value={form.bank_details?.account_number ?? ""} onChange={(e) => setBank("account_number", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>IFSC Code</Label>
                    <Input value={form.bank_details?.ifsc ?? ""} onChange={(e) => setBank("ifsc", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Bank Name</Label>
                    <Input value={form.bank_details?.bank_name ?? ""} onChange={(e) => setBank("bank_name", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Account Name</Label>
                    <Input value={form.bank_details?.account_name ?? ""} onChange={(e) => setBank("account_name", e.target.value)} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <Button onClick={handleSave} disabled={saving} className="bg-[#e94560] hover:bg-[#c73652] flex-1">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
