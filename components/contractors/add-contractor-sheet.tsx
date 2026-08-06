"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { createContractor, updateContractor, assignContractorToProject } from "@/app/actions/contractors"
import type { Contractor } from "@/app/actions/contractors"

interface AddContractorSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editContractor?: Contractor | null
  /** When set, a newly created contractor is immediately linked to this project. */
  projectId?: string
  onCreated?: (c: Contractor) => void
  onUpdated?: () => void
}

export function AddContractorSheet({ open, onOpenChange, editContractor, projectId, onCreated, onUpdated }: AddContractorSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [companyName, setCompanyName] = useState(editContractor?.company_name ?? "")
  const [companyType, setCompanyType] = useState(editContractor?.company_type ?? "")
  const [contactName, setContactName] = useState(editContractor?.contact_name ?? "")
  const [phone, setPhone] = useState(editContractor?.phone ?? "")
  const [email, setEmail] = useState(editContractor?.email ?? "")
  const [whatsappNumber, setWhatsappNumber] = useState(editContractor?.whatsapp_number ?? "")
  const [address, setAddress] = useState(editContractor?.address ?? "")
  const [gstin, setGstin] = useState(editContractor?.gstin ?? "")
  const [taxBracket, setTaxBracket] = useState(editContractor?.tax_bracket ?? "")
  const [supervisorName, setSupervisorName] = useState(editContractor?.site_supervisor_name ?? "")
  const [supervisorPhone, setSupervisorPhone] = useState(editContractor?.site_supervisor_phone ?? "")

  async function handleSave() {
    if (!companyName.trim() || !contactName.trim() || !phone.trim()) {
      toast({ title: "Company name, contact name and phone are required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editContractor) {
        await updateContractor(editContractor.id, {
          company_name: companyName.trim(),
          company_type: companyType || null,
          contact_name: contactName.trim(),
          phone: phone.trim(),
          email: email || null,
          whatsapp_number: whatsappNumber || null,
          address: address || null,
          gstin: gstin || null,
          tax_bracket: taxBracket || null,
          site_supervisor_name: supervisorName || null,
          site_supervisor_phone: supervisorPhone || null,
        })
        onUpdated?.()
        toast({ title: "Contractor updated" })
      } else {
        const created = await createContractor({
          companyName: companyName.trim(),
          companyType: companyType || undefined,
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: email || undefined,
          whatsappNumber: whatsappNumber || undefined,
          address: address || undefined,
          gstin: gstin || undefined,
          taxBracket: taxBracket || undefined,
          siteSupervisorName: supervisorName || undefined,
          siteSupervisorPhone: supervisorPhone || undefined,
        })
        if (projectId) {
          await assignContractorToProject(created.id, projectId)
        }
        onCreated?.(created)
        toast({ title: "Contractor added" })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>{editContractor ? "Edit Contractor" : "Add Contractor"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Company Name *</label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ABC Construction Ltd" className="focus-visible:ring-[#e94560]" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-sm font-medium mb-1.5 block">Company Type</label>
              <Input value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="Civil, MEP, Interior…" className="focus-visible:ring-[#e94560]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contact Name *</label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="focus-visible:ring-[#e94560]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Phone *</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="focus-visible:ring-[#e94560]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="focus-visible:ring-[#e94560]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">WhatsApp Number</label>
              <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} type="tel" className="focus-visible:ring-[#e94560]" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Address</label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="focus-visible:ring-[#e94560]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">GSTIN</label>
              <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="15-character GSTIN" className="focus-visible:ring-[#e94560]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tax Bracket</label>
              <Input value={taxBracket} onChange={(e) => setTaxBracket(e.target.value)} placeholder="e.g. 18%" className="focus-visible:ring-[#e94560]" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Site Supervisor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name</label>
                <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="focus-visible:ring-[#e94560]" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone</label>
                <Input value={supervisorPhone} onChange={(e) => setSupervisorPhone(e.target.value)} type="tel" className="focus-visible:ring-[#e94560]" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#e94560] hover:bg-[#d63850] text-white">
            {saving ? "Saving…" : editContractor ? "Save Changes" : "Add Contractor"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
