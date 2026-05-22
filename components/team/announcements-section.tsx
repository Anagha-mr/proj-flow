"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Pin, PinOff, Plus, Pencil, Trash2, X, Check } from "lucide-react"
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from "@/app/actions/team"

interface Props {
  announcements: Announcement[]
  currentUserRole: string
  onAnnouncementsChange: (announcements: Announcement[]) => void
}

export function AnnouncementsSection({ announcements, currentUserRole, onAnnouncementsChange }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const canManage = currentUserRole === "owner" || currentUserRole === "senior_designer"
  const canDelete = currentUserRole === "owner"

  const [editForm, setEditForm] = useState({ title: "", body: "", is_pinned: false })
  const [newForm, setNewForm] = useState({ title: "", body: "", is_pinned: false })

  const startEdit = (ann: Announcement) => {
    setEditingId(ann.id)
    setEditForm({ title: ann.title, body: ann.body, is_pinned: ann.is_pinned })
  }

  const cancelEdit = () => setEditingId(null)

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      try {
        await updateAnnouncement(id, { title: editForm.title, body: editForm.body, is_pinned: editForm.is_pinned })
        onAnnouncementsChange(
          announcements
            .map(a => a.id === id ? { ...a, ...editForm } : a)
            .sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            })
        )
        setEditingId(null)
        toast({ title: "Announcement updated" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleTogglePin = (ann: Announcement) => {
    startTransition(async () => {
      try {
        await updateAnnouncement(ann.id, { is_pinned: !ann.is_pinned })
        const updated = announcements
          .map(a => a.id === ann.id ? { ...a, is_pinned: !ann.is_pinned } : a)
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
        onAnnouncementsChange(updated)
        toast({ title: ann.is_pinned ? "Unpinned" : "Pinned" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteAnnouncement(id)
        onAnnouncementsChange(announcements.filter(a => a.id !== id))
        toast({ title: "Announcement deleted" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleCreate = () => {
    if (!newForm.title.trim() || !newForm.body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        const created = await createAnnouncement({ title: newForm.title, body: newForm.body, isPinned: newForm.is_pinned })
        const updated = [...announcements, created]
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
        onAnnouncementsChange(updated)
        setNewForm({ title: "", body: "", is_pinned: false })
        setShowNew(false)
        toast({ title: "Announcement posted" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Announcements</h3>
        {canManage && !showNew && (
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New
          </Button>
        )}
      </div>

      {/* New announcement inline form */}
      {showNew && canManage && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={newForm.title}
              onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title"
            />
          </div>
          <div className="space-y-1">
            <Label>Body</Label>
            <Textarea
              value={newForm.body}
              onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Announcement body…"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pin-new"
              checked={newForm.is_pinned}
              onChange={e => setNewForm(f => ({ ...f, is_pinned: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="pin-new" className="cursor-pointer">Pin to top</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isPending}>Post</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewForm({ title: "", body: "", is_pinned: false }) }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Announcement list */}
      {announcements.length === 0 && !showNew ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="divide-y">
          {announcements.map(ann => (
            <div
              key={ann.id}
              className={`py-3 ${ann.is_pinned ? "bg-amber-50 -mx-4 px-4" : ""}`}
            >
              {editingId === ann.id ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <Textarea
                    value={editForm.body}
                    onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`pin-${ann.id}`}
                      checked={editForm.is_pinned}
                      onChange={e => setEditForm(f => ({ ...f, is_pinned: e.target.checked }))}
                    />
                    <Label htmlFor={`pin-${ann.id}`} className="cursor-pointer text-sm">Pinned</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(ann.id)} disabled={isPending}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === ann.id ? null : ann.id)}
                    >
                      <span className="text-sm font-medium">
                        {ann.is_pinned && <span className="mr-1">📌</span>}
                        {ann.title}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDistanceToNow(parseISO(ann.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title={ann.is_pinned ? "Unpin" : "Pin"}
                          onClick={() => handleTogglePin(ann)}
                          disabled={isPending}
                        >
                          {ann.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startEdit(ann)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(ann.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                  </div>
                  {expandedId === ann.id && (
                    <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{ann.body}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
