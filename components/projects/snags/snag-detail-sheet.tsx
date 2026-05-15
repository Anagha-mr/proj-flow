"use client"

import { useState, useRef } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { resolveSnagItem, reopenSnagItem, deleteSnagItem, updateSnagStatus } from "@/app/actions/snags"
import type { SnagItem } from "@/app/actions/snags"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:              { label: "Open",         className: "bg-red-100 text-red-700" },
  in_progress:       { label: "In Progress",  className: "bg-amber-100 text-amber-700" },
  resolved:          { label: "Resolved",     className: "bg-blue-100 text-blue-700" },
  client_signed_off: { label: "Signed Off",   className: "bg-green-100 text-green-700" },
}

interface SnagDetailSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  snag: SnagItem
  canManage: boolean
  studioId: string
  projectId: string
  onUpdated: (snag: SnagItem) => void
  onDeleted: (snagId: string) => void
}

export function SnagDetailSheet({ open, onOpenChange, snag: initialSnag, canManage, studioId, projectId, onUpdated, onDeleted }: SnagDetailSheetProps) {
  const { toast } = useToast()
  const [snag, setSnag] = useState(initialSnag)
  const [resolutionPhotoUrl, setResolutionPhotoUrl] = useState("")
  const [resolutionPhotoPreview, setResolutionPhotoPreview] = useState("")
  const [resolutionNote, setResolutionNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const statusMeta = STATUS_BADGE[snag.status] ?? STATUS_BADGE.open

  async function handleResolutionPhotoUpload(file: File) {
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()
      const path = `${studioId}/${projectId}/snags/resolution/${Date.now()}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from("project-files").upload(path, file, { upsert: false })
      if (error) throw new Error(error.message)
      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path)
      setResolutionPhotoUrl(urlData.publicUrl)
      setResolutionPhotoPreview(URL.createObjectURL(file))
    } catch (err) {
      toast({ title: "Upload failed: " + String(err), variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleResolve() {
    if (!resolutionPhotoUrl || !resolutionNote.trim()) {
      toast({ title: "Both resolution photo and note are required", variant: "destructive" })
      return
    }
    setResolving(true)
    try {
      await resolveSnagItem(snag.id, { resolutionPhotoUrl, resolutionNote: resolutionNote.trim() })
      const updated = { ...snag, status: 'resolved' as SnagItem['status'], resolution_photo_url: resolutionPhotoUrl, resolution_note: resolutionNote.trim() }
      setSnag(updated)
      onUpdated(updated)
      setShowResolveForm(false)
      toast({ title: "Snag item resolved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setResolving(false)
    }
  }

  async function handleReopen() {
    try {
      await reopenSnagItem(snag.id)
      const updated = { ...snag, status: 'open' as SnagItem['status'], resolution_photo_url: null, resolution_note: null }
      setSnag(updated)
      onUpdated(updated)
      toast({ title: "Snag item reopened" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleDelete() {
    try {
      await deleteSnagItem(snag.id)
      onDeleted(snag.id)
      onOpenChange(false)
      toast({ title: "Snag item deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleMarkInProgress() {
    try {
      await updateSnagStatus(snag.id, 'in_progress')
      const updated = { ...snag, status: 'in_progress' as SnagItem['status'] }
      setSnag(updated)
      onUpdated(updated)
      toast({ title: "Marked in progress" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  const canResolve = canManage && (snag.status === 'open' || snag.status === 'in_progress')
  const canReopen = canManage && snag.status === 'resolved'
  const canDelete = canManage && snag.status === 'open'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto flex flex-col">
        <SheetHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{snag.location_description}</SheetTitle>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusMeta.className}`}>{statusMeta.label}</span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1 overflow-y-auto">
          {/* Photo */}
          <div className="rounded-lg overflow-hidden bg-gray-100 max-h-[280px] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snag.photo_url} alt={snag.location_description} className="w-full max-h-[280px] object-contain" />
          </div>

          {/* Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Details</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {snag.plan_reference && (
                <>
                  <dt className="text-muted-foreground">Plan Reference</dt>
                  <dd>{snag.plan_reference}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Assigned To</dt>
              <dd className="capitalize">{snag.assignee_name ?? snag.assigned_to_id} ({snag.assigned_to_type})</dd>
              {snag.due_date && (
                <>
                  <dt className="text-muted-foreground">Due Date</dt>
                  <dd>{format(new Date(snag.due_date + "T00:00:00"), "d MMM yyyy")}</dd>
                </>
              )}
            </dl>
            <p className="text-sm text-gray-700 mt-2">{snag.description}</p>
          </section>

          {/* Resolve form — slides in */}
          {canResolve && (
            <section>
              {!showResolveForm ? (
                <div className="flex gap-2">
                  {snag.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={handleMarkInProgress}>Mark In Progress</Button>
                  )}
                  <Button size="sm" className="bg-[#e94560] hover:bg-[#d63850] text-white" onClick={() => setShowResolveForm(true)}>
                    Mark as Resolved
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3 transition-all">
                  <h3 className="text-sm font-semibold text-gray-700">Resolve Snag</h3>
                  {/* Resolution photo */}
                  {resolutionPhotoPreview ? (
                    <div className="rounded-lg overflow-hidden aspect-video bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolutionPhotoPreview} alt="Resolution" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#e94560] text-muted-foreground hover:text-[#e94560] text-sm transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      {uploading ? "Uploading…" : "Upload resolution photo *"}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResolutionPhotoUpload(f) }}
                  />
                  <Textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Describe how the issue was resolved… *"
                    rows={3}
                    className="focus-visible:ring-[#e94560]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-[#e94560] hover:bg-[#d63850] text-white"
                      onClick={handleResolve}
                      disabled={resolving || !resolutionPhotoUrl || !resolutionNote.trim()}
                    >
                      {resolving ? "Saving…" : "Confirm Resolved"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowResolveForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Resolution details */}
          {(snag.status === 'resolved' || snag.status === 'client_signed_off') && snag.resolution_photo_url && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Resolution</h3>
              <div className="rounded-lg overflow-hidden aspect-video bg-gray-100 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snag.resolution_photo_url} alt="Resolution" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm text-gray-700">{snag.resolution_note}</p>
              {snag.status === 'resolved' && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2">
                  Awaiting client sign-off via portal
                </div>
              )}
              {snag.status === 'client_signed_off' && (
                <div className="mt-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2">
                  Signed off by {snag.client_signed_off_by} on{" "}
                  {snag.client_signed_off_at ? format(new Date(snag.client_signed_off_at), "d MMM yyyy") : ""}
                </div>
              )}
            </section>
          )}

          {/* Footer actions */}
          <div className="flex gap-2 pb-4">
            {canReopen && (
              <Button variant="outline" size="sm" onClick={handleReopen}>Reopen</Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/5" onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
