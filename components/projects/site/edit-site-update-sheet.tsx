"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import { format } from "date-fns"
import { updateSiteUpdate } from "@/app/actions/site"
import { useToast } from "@/hooks/use-toast"
import type { SiteUpdate } from "@/app/actions/site"

type PhaseValue = "before" | "during" | "after" | "none"

interface EditSiteUpdateSheetProps {
  update: SiteUpdate | null
  onOpenChange: (open: boolean) => void
  onSaved: (update: SiteUpdate) => void
  existingSpaceTags: string[]
}

export function EditSiteUpdateSheet({
  update,
  onOpenChange,
  onSaved,
  existingSpaceTags,
}: EditSiteUpdateSheetProps) {
  return (
    <Sheet open={!!update} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Site Update</SheetTitle>
        </SheetHeader>

        {update && (
          <EditSiteUpdateForm
            key={update.id}
            update={update}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
            existingSpaceTags={existingSpaceTags}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditSiteUpdateForm({
  update,
  onOpenChange,
  onSaved,
  existingSpaceTags,
}: EditSiteUpdateSheetProps & { update: SiteUpdate }) {
  const { toast } = useToast()
  const [spaceTag, setSpaceTag] = useState(update.space_tag ?? "")
  const [phaseTag, setPhaseTag] = useState<PhaseValue>(update.phase_tag ?? "none")
  const [statusNote, setStatusNote] = useState(update.status_note ?? "")
  const [isClientVisible, setIsClientVisible] = useState(update.is_client_visible)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await updateSiteUpdate(update.id, {
        spaceTag: spaceTag || null,
        phaseTag: phaseTag === "none" ? null : phaseTag,
        statusNote: statusNote || null,
        isClientVisible,
      })
      toast({ title: "Site update saved" })
      onSaved({ ...saved, submitter: update.submitter })
      onOpenChange(false)
    } catch (err) {
      toast({ title: "Failed to save", description: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 mt-6">
      {/* Photos — read-only, immutable for audit trail */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-sm font-medium">Photos</label>
          <Lock className="w-3.5 h-3.5 text-gray-400" />
        </div>
        {update.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {update.photos.map((photo, idx) => (
              <div key={idx} className="aspect-square rounded-md overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`photo ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No photos</p>
        )}
        <p className="text-xs text-gray-400 mt-1.5">
          Photos can&apos;t be changed after submission. Submitted{" "}
          {format(new Date(update.submitted_at), "d MMM yyyy, h:mm a")}
          {update.submitter?.name ? ` by ${update.submitter.name}` : ""}.
        </p>
      </div>

      {/* Space tag with datalist */}
      <div>
        <label className="text-sm font-medium block mb-1.5">Space Tag (optional)</label>
        <Input
          value={spaceTag}
          onChange={(e) => setSpaceTag(e.target.value)}
          list="edit-space-tag-suggestions"
          placeholder="e.g. Living Room, Kitchen"
          className="focus-visible:ring-[#e94560]"
        />
        <datalist id="edit-space-tag-suggestions">
          {existingSpaceTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>

      {/* Phase */}
      <div>
        <label className="text-sm font-medium block mb-1.5">Phase (optional)</label>
        <Select value={phaseTag} onValueChange={(v) => setPhaseTag(v as PhaseValue)}>
          <SelectTrigger className="focus:ring-[#e94560]">
            <SelectValue placeholder="Select phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No phase</SelectItem>
            <SelectItem value="before">Before</SelectItem>
            <SelectItem value="during">During</SelectItem>
            <SelectItem value="after">After</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status note */}
      <div>
        <label className="text-sm font-medium block mb-1.5">Status Note (optional)</label>
        <Textarea
          value={statusNote}
          onChange={(e) => setStatusNote(e.target.value)}
          placeholder="Brief description of work done..."
          rows={3}
          maxLength={500}
          className="focus-visible:ring-[#e94560] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{statusNote.length}/500</p>
      </div>

      {/* Client visible toggle */}
      <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg p-3">
        <div>
          <Label htmlFor="edit-client-visible" className="text-sm font-medium">Visible to client in portal</Label>
          <p className="text-xs text-gray-500 mt-0.5">Client can see this update in their portal</p>
        </div>
        <Switch
          id="edit-client-visible"
          checked={isClientVisible}
          onCheckedChange={setIsClientVisible}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
      >
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  )
}
