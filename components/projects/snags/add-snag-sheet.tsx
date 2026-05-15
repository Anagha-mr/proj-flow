"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createSnagItem } from "@/app/actions/snags"
import type { SnagItem } from "@/app/actions/snags"
import type { Contractor } from "@/app/actions/contractors"

interface StudioUser { id: string; name: string; role: string }

interface AddSnagSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: { id: string; studio_id: string }
  projectContractors: Contractor[]
  studioUsers: StudioUser[]
  onCreated: (snag: SnagItem) => void
}

type AssignedToType = 'contractor' | 'vendor' | 'designer'

export function AddSnagSheet({ open, onOpenChange, project, projectContractors, studioUsers, onCreated }: AddSnagSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [photoUrl, setPhotoUrl] = useState("")
  const [photoPreview, setPhotoPreview] = useState("")
  const [uploading, setUploading] = useState(false)
  const [locationDescription, setLocationDescription] = useState("")
  const [planReference, setPlanReference] = useState("")
  const [description, setDescription] = useState("")
  const [assignedToType, setAssignedToType] = useState<AssignedToType>("contractor")
  const [assignedToId, setAssignedToId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [dueDate, setDueDate] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoUpload(file: File) {
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()
      const path = `${project.studio_id}/${project.id}/snags/${Date.now()}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from("project-files").upload(path, file, { upsert: false })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path)
      setPhotoUrl(urlData.publicUrl)
      setPhotoPreview(URL.createObjectURL(file))
    } catch (err) {
      toast({ title: "Photo upload failed: " + String(err), variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!photoUrl) {
      toast({ title: "Photo is required", variant: "destructive" })
      return
    }
    if (!locationDescription.trim() || !description.trim()) {
      toast({ title: "Location and description are required", variant: "destructive" })
      return
    }
    const resolvedId = assignedToType === 'vendor' ? (vendorName.trim() || "Vendor") : assignedToId
    if (!resolvedId) {
      toast({ title: "Please select an assignee", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const created = await createSnagItem({
        projectId: project.id,
        photoUrl,
        locationDescription: locationDescription.trim(),
        planReference: planReference || undefined,
        description: description.trim(),
        assignedToType,
        assignedToId: resolvedId,
        dueDate: dueDate || undefined,
      })
      onCreated(created)
      toast({ title: "Snag item added" })
      onOpenChange(false)
      // reset
      setPhotoUrl(""); setPhotoPreview(""); setLocationDescription(""); setPlanReference("")
      setDescription(""); setAssignedToType("contractor"); setAssignedToId(""); setVendorName(""); setDueDate("")
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Add Snag Item</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1">
          {/* Photo upload */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Photo *</label>
            {photoPreview ? (
              <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setPhotoUrl(""); setPhotoPreview("") }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center gap-2 w-full aspect-[4/3] border-2 border-dashed border-gray-200 rounded-lg hover:border-[#e94560] transition-colors text-muted-foreground hover:text-[#e94560]"
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm">{uploading ? "Uploading…" : "Click to upload photo"}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePhotoUpload(file)
              }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Location Description *</label>
            <Input value={locationDescription} onChange={(e) => setLocationDescription(e.target.value)} placeholder="e.g. Master bedroom north wall" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Plan Reference</label>
            <Input value={planReference} onChange={(e) => setPlanReference(e.target.value)} placeholder="e.g. Drawing A-101, Grid B3" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the defect or issue…" rows={3} className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Assigned To Type *</label>
            <Select value={assignedToType} onValueChange={(v) => { setAssignedToType(v as AssignedToType); setAssignedToId("") }}>
              <SelectTrigger className="focus:ring-[#e94560]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignedToType === 'contractor' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Select Contractor *</label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger className="focus:ring-[#e94560]"><SelectValue placeholder="Choose contractor…" /></SelectTrigger>
                <SelectContent>
                  {projectContractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignedToType === 'designer' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Select Designer *</label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger className="focus:ring-[#e94560]"><SelectValue placeholder="Choose designer…" /></SelectTrigger>
                <SelectContent>
                  {studioUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignedToType === 'vendor' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Vendor Name *</label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor / supplier name" className="focus-visible:ring-[#e94560]" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="focus-visible:ring-[#e94560]" />
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <Button
            onClick={handleSave}
            disabled={saving || uploading || !photoUrl}
            className="w-full bg-[#e94560] hover:bg-[#d63850] text-white"
          >
            {saving ? "Adding…" : !photoUrl ? "Upload photo to continue" : "Add Snag Item"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
