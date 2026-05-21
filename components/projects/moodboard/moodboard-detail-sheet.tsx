"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExternalLink, Lock, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createMoodboard, updateMoodboard, deleteMoodboard } from "@/app/actions/moodboards"
import type { Moodboard } from "@/app/actions/moodboards"
import { format } from "date-fns"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  moodboard: Moodboard | null
  projectId: string
  onSaved: (m: Moodboard) => void
}

export function MoodboardDetailSheet({ open, onOpenChange, moodboard, projectId, onSaved }: Props) {
  const { toast } = useToast()
  const isNew = !moodboard

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<Moodboard["status"]>("draft")
  const [isClientVisible, setIsClientVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (moodboard) {
      setTitle(moodboard.title)
      setDescription(moodboard.description ?? "")
      setStatus(moodboard.status)
      setIsClientVisible(moodboard.is_client_visible)
    } else {
      setTitle("")
      setDescription("")
      setStatus("draft")
      setIsClientVisible(false)
    }
    setConfirmDelete(false)
  }, [moodboard, open])

  const isApprovedLocked = !!moodboard?.client_approved_at

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        const created = await createMoodboard({
          project_id: projectId,
          title: title.trim(),
          description: description.trim() || undefined,
        })
        toast({ title: "Moodboard created" })
        onSaved(created)
      } else {
        const updated = await updateMoodboard(moodboard!.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          is_client_visible: isClientVisible,
        })
        toast({ title: "Saved" })
        onSaved(updated)
      }
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleUnlink() {
    if (!moodboard) return
    setSaving(true)
    try {
      const updated = await updateMoodboard(moodboard.id, {
        canva_design_id: null,
        canva_embed_url: null,
        canva_edit_url: null,
        canva_export_url: null,
      })
      toast({ title: "Canva design unlinked" })
      onSaved(updated)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!moodboard) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await deleteMoodboard(moodboard.id)
      toast({ title: "Moodboard deleted" })
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = moodboard && (moodboard.status === "draft" || moodboard.status === "archived")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "New Moodboard" : "Edit Moodboard"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Living Room Concept A"
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What concept or room does this moodboard cover?"
              rows={3}
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            {isApprovedLocked ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2">
                <Lock className="w-4 h-4 text-green-600" />
                Approved by {moodboard?.client_approved_by} on{" "}
                {moodboard?.client_approved_at
                  ? format(new Date(moodboard.client_approved_at), "dd MMM yyyy")
                  : "—"}
              </div>
            ) : (
              <Select value={status} onValueChange={(v) => setStatus(v as Moodboard["status"])}>
                <SelectTrigger className="focus:ring-[#e94560]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="shared_with_client">Shared with Client</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Client visible toggle */}
          {!isNew && (
            <div className="flex items-center justify-between">
              <Label htmlFor="client-visible">Show to client in portal</Label>
              <Switch
                id="client-visible"
                checked={isClientVisible}
                onCheckedChange={setIsClientVisible}
              />
            </div>
          )}

          {/* Canva section */}
          {moodboard?.canva_design_id && (
            <div className="flex flex-col gap-2 border rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Canva Design
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1 truncate">
                  {moodboard.canva_design_id}
                </span>
                {moodboard.canva_edit_url && (
                  <a
                    href={moodboard.canva_edit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs text-[#e94560] hover:underline"
                  >
                    Open in Canva <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnlink}
                  disabled={saving}
                  className="shrink-0 text-xs"
                >
                  Unlink
                </Button>
              </div>
            </div>
          )}

          {/* Client feedback */}
          {moodboard?.client_feedback && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Client Feedback
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                {moodboard.client_feedback}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {isNew ? "Create" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            {canDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="ml-auto"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {confirmDelete ? "Confirm Delete" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
