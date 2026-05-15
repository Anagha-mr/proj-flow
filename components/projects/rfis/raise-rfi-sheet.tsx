"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createRfi } from "@/app/actions/rfis"
import type { RFI } from "@/app/actions/rfis"
import type { Contractor } from "@/app/actions/contractors"

const DEADLINE_OPTIONS = [
  { label: "24 hours",  value: "24" },
  { label: "48 hours",  value: "48" },
  { label: "72 hours",  value: "72" },
  { label: "1 week",    value: "168" },
]

interface RaiseRfiSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: { id: string; name: string }
  projectDocuments: Array<{ id: string; name: string }>
  projectContractors: Contractor[]
  onCreated: (rfi: RFI) => void
}

export function RaiseRfiSheet({ open, onOpenChange, project, projectDocuments, projectContractors, onCreated }: RaiseRfiSheetProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [raisedByType, setRaisedByType] = useState<'designer' | 'contractor'>("designer")
  const [contractorId, setContractorId] = useState("")
  const [linkedDocumentId, setLinkedDocumentId] = useState("")
  const [spaceTag, setSpaceTag] = useState("")
  const [deadlineHours, setDeadlineHours] = useState("48")

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const created = await createRfi({
        projectId: project.id,
        title: title.trim(),
        description: description.trim(),
        contractorId: contractorId || undefined,
        linkedDocumentId: linkedDocumentId || undefined,
        spaceTag: spaceTag || undefined,
        raisedByType,
        responseDeadlineHours: parseInt(deadlineHours),
      })
      onCreated(created)
      toast({ title: "RFI raised" })
      onOpenChange(false)
      // reset
      setTitle(""); setDescription(""); setRaisedByType("designer")
      setContractorId(""); setLinkedDocumentId(""); setSpaceTag(""); setDeadlineHours("48")
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
          <SheetTitle>Raise RFI</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the query" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description of the information required…" rows={4} className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Raised By</label>
            <Select value={raisedByType} onValueChange={(v) => setRaisedByType(v as 'designer' | 'contractor')}>
              <SelectTrigger className="focus:ring-[#e94560]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {raisedByType === 'contractor' && projectContractors.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contractor</label>
              <Select value={contractorId} onValueChange={setContractorId}>
                <SelectTrigger className="focus:ring-[#e94560]"><SelectValue placeholder="Select contractor…" /></SelectTrigger>
                <SelectContent>
                  {projectContractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name} — {c.contact_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {projectDocuments.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Linked Document</label>
              <Select value={linkedDocumentId} onValueChange={setLinkedDocumentId}>
                <SelectTrigger className="focus:ring-[#e94560]"><SelectValue placeholder="Select document (optional)…" /></SelectTrigger>
                <SelectContent>
                  {projectDocuments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Space / Area Tag</label>
            <Input value={spaceTag} onChange={(e) => setSpaceTag(e.target.value)} placeholder="e.g. Master Bedroom, Kitchen" className="focus-visible:ring-[#e94560]" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Response Deadline</label>
            <Select value={deadlineHours} onValueChange={setDeadlineHours}>
              <SelectTrigger className="focus:ring-[#e94560]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEADLINE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <Button onClick={handleSubmit} disabled={saving} className="w-full bg-[#e94560] hover:bg-[#d63850] text-white">
            {saving ? "Raising…" : "Raise RFI"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
