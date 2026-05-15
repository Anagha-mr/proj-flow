"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createClient, updateClient } from "@/app/actions/projects"

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
]

const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "AP","Arunachal Pradesh": "AR","Assam": "AS","Bihar": "BR",
  "Chhattisgarh": "CG","Goa": "GA","Gujarat": "GJ","Haryana": "HR","Himachal Pradesh": "HP",
  "Jharkhand": "JH","Karnataka": "KA","Kerala": "KL","Madhya Pradesh": "MP","Maharashtra": "MH",
  "Manipur": "MN","Meghalaya": "ML","Mizoram": "MZ","Nagaland": "NL","Odisha": "OD",
  "Punjab": "PB","Rajasthan": "RJ","Sikkim": "SK","Tamil Nadu": "TN","Telangana": "TG",
  "Tripura": "TR","Uttar Pradesh": "UP","Uttarakhand": "UK","West Bengal": "WB",
  "Delhi": "DL",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientRow = Record<string, any>

interface AddClientSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editClient?: ClientRow | null
  onSaved: (client: ClientRow) => void
}

export function AddClientSheet({ open, onOpenChange, editClient, onSaved }: AddClientSheetProps) {
  const { toast } = useToast()
  const isEdit = !!editClient

  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [phonePrimary, setPhonePrimary] = useState("")
  const [phoneSecondary, setPhoneSecondary] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [postcode, setPostcode] = useState("")
  const [stateName, setStateName] = useState("")
  const [preferredComms, setPreferredComms] = useState("whatsapp")
  const [availableHours, setAvailableHours] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editClient) {
      setName(editClient.name ?? "")
      setCompany(editClient.company ?? "")
      setPhonePrimary(editClient.phone_primary ?? "")
      setPhoneSecondary(editClient.phone_secondary ?? "")
      setEmail(editClient.email ?? "")
      setWhatsapp(editClient.whatsapp_number ?? "")
      setAddress1(editClient.address_line1 ?? "")
      setAddress2(editClient.address_line2 ?? "")
      setPostcode(editClient.postcode ?? "")
      const sc = editClient.state_code ?? ""
      const found = Object.entries(STATE_CODES).find(([, v]) => v === sc)?.[0] ?? ""
      setStateName(found)
      setPreferredComms(editClient.preferred_comms ?? "whatsapp")
      setAvailableHours(editClient.available_hours ?? "")
    } else {
      setName(""); setCompany(""); setPhonePrimary(""); setPhoneSecondary("")
      setEmail(""); setWhatsapp(""); setAddress1(""); setAddress2("")
      setPostcode(""); setStateName(""); setPreferredComms("whatsapp"); setAvailableHours("")
    }
  }, [editClient, open])

  async function handleSave() {
    if (!name.trim() || !phonePrimary.trim() || !email.trim()) {
      toast({ title: "Name, primary phone, and email are required", variant: "destructive" })
      return
    }
    setSaving(true)
    const stateCode = STATE_CODES[stateName] ?? stateName
    const payload = {
      name: name.trim(),
      company: company.trim() || null,
      email: email.trim(),
      phone_primary: phonePrimary.trim(),
      phone_secondary: phoneSecondary.trim() || null,
      whatsapp_number: whatsapp.trim() || null,
      address_line1: address1.trim() || null,
      address_line2: address2.trim() || null,
      postcode: postcode.trim() || null,
      state_code: stateCode || null,
      preferred_comms: preferredComms,
      available_hours: availableHours.trim() || null,
    }
    try {
      let result: ClientRow
      if (isEdit && editClient) {
        result = await updateClient(editClient.id, payload)
        toast({ title: "Client updated" })
      } else {
        result = await createClient(payload)
        toast({ title: "Client added" })
      }
      onSaved(result)
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Client" : "Add Client"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Name *</Label>
              <Input placeholder="Priya Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Company</Label>
              <Input placeholder="Sharma Enterprises" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Primary Phone *</Label>
              <Input placeholder="+91 98765 43210" value={phonePrimary} onChange={(e) => setPhonePrimary(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Secondary Phone</Label>
              <Input placeholder="+91 98765 43211" value={phoneSecondary} onChange={(e) => setPhoneSecondary(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Email *</Label>
              <Input type="email" placeholder="priya@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">WhatsApp Number</Label>
              <Input placeholder="+91 98765 43210" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Address Line 1</Label>
            <Input placeholder="Flat 4B, Sunrise Apartments" value={address1} onChange={(e) => setAddress1(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Address Line 2</Label>
            <Input placeholder="MG Road, Indiranagar" value={address2} onChange={(e) => setAddress2(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Postcode</Label>
              <Input placeholder="560038" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">State</Label>
              <Select value={stateName} onValueChange={setStateName}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Preferred Communication</Label>
              <Select value={preferredComms} onValueChange={setPreferredComms}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Available Hours</Label>
              <Input placeholder="10am–6pm weekdays" value={availableHours} onChange={(e) => setAvailableHours(e.target.value)} />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save Client" : "Add Client"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
