"use client"

import { useState, useRef, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  approveNarrative,
  editAndApproveNarrative,
  skipNarrative,
  sendNarrative,
} from "@/app/actions/narratives"
import type { WeeklyNarrative } from "@/app/actions/narratives"
import { format } from "date-fns"

interface NarrativeReviewCardProps {
  narrative: WeeklyNarrative
  onStatusChange?: (id: string, status: WeeklyNarrative["status"]) => void
}

export function NarrativeReviewCard({ narrative: initial, onStatusChange }: NarrativeReviewCardProps) {
  const { toast } = useToast()
  const [narrative, setNarrative] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(initial.final_text)
  const [loading, setLoading] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const clientName = narrative.client?.name ?? "Client"
  const projectName = narrative.project?.name ?? "Project"
  const weekLabel = narrative.week_start_date
    ? format(new Date(narrative.week_start_date + "T00:00:00"), "d MMM yyyy")
    : ""

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`
    }
  }, [editing, editText])

  async function handleApproveAndSend() {
    setLoading(true)
    try {
      await approveNarrative(narrative.id)
      await sendNarrative(narrative.id)
      const updated = { ...narrative, status: "sent" as const, sent_at: new Date().toISOString() }
      setNarrative(updated)
      onStatusChange?.(narrative.id, "sent")
      toast({ title: `Update sent to ${clientName} ✓` })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSendNow() {
    setLoading(true)
    try {
      await sendNarrative(narrative.id)
      const updated = { ...narrative, status: "sent" as const, sent_at: new Date().toISOString() }
      setNarrative(updated)
      onStatusChange?.(narrative.id, "sent")
      toast({ title: `Update sent to ${clientName} ✓` })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndApprove() {
    if (!editText.trim()) {
      toast({ title: "Text cannot be empty", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      await editAndApproveNarrative(narrative.id, editText)
      const updated = { ...narrative, edited_text: editText, final_text: editText, status: "approved" as const }
      setNarrative(updated)
      onStatusChange?.(narrative.id, "approved")
      setEditing(false)
      toast({ title: "Narrative approved" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    setLoading(true)
    try {
      await skipNarrative(narrative.id)
      const updated = { ...narrative, status: "skipped" as const }
      setNarrative(updated)
      onStatusChange?.(narrative.id, "skipped")
      setConfirmSkip(false)
      toast({ title: "Narrative skipped" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = {
    draft: null,
    approved: (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        ✓ Approved
      </span>
    ),
    sent: (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        ● Sent {narrative.sent_at ? format(new Date(narrative.sent_at), "h:mm a") : ""}
      </span>
    ),
    skipped: (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        — Skipped
      </span>
    ),
    failed: (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        ✕ Failed
      </span>
    ),
  }[narrative.status]

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[#e94560]" style={{ fontSize: 12 }}>✦</span>
          <span className="text-xs text-muted-foreground">Weekly Update Ready</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{projectName}</p>
          <p className="text-xs text-muted-foreground">
            For {clientName} · Week of {weekLabel}
          </p>
        </div>
      </div>

      {/* Status badge if not draft */}
      {statusBadge && (
        <div className="px-4 pb-1">{statusBadge}</div>
      )}

      {/* Narrative text */}
      <div className="px-4 pb-2">
        {editing ? (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={1000}
              rows={4}
              style={{ resize: "none", minHeight: 80, maxHeight: 192 }}
              className="w-full text-sm text-foreground leading-relaxed bg-surface border border-[#e94560]/30 rounded-[6px] p-3 focus:outline-none focus:border-[#e94560]/60 overflow-y-auto"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
              {editText.length}/1000
            </span>
          </div>
        ) : (
          <div className="max-w-prose">
            <p className="text-sm text-foreground leading-relaxed">{narrative.final_text}</p>
            {narrative.status === "draft" && (
              <button
                onClick={() => {
                  setEditText(narrative.final_text)
                  setEditing(true)
                }}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ✏ Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {narrative.status === "draft" && (
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1 border-t border-border">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                disabled={loading}
                className="text-xs text-muted-foreground border border-border rounded-[6px] px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndApprove}
                disabled={loading}
                className="text-xs text-white bg-[#e94560] hover:bg-[#e94560]/90 rounded-[6px] px-4 py-1.5 transition-colors disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save & Approve"}
              </button>
            </>
          ) : (
            <>
              {confirmSkip ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Skip this update?</span>
                  <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="text-xs text-red-600 border border-red-200 rounded-[6px] px-3 py-1 hover:bg-red-50 transition-colors"
                  >
                    Yes, skip
                  </button>
                  <button
                    onClick={() => setConfirmSkip(false)}
                    className="text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmSkip(true)}
                  disabled={loading}
                  className="text-xs text-muted-foreground border border-border rounded-[6px] px-3 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  ✕ Skip
                </button>
              )}
              <button
                onClick={handleApproveAndSend}
                disabled={loading}
                className="text-xs text-white bg-[#e94560] hover:bg-[#e94560]/90 rounded-[6px] px-4 py-1.5 transition-colors disabled:opacity-60 flex items-center gap-1.5 sm:w-auto w-full justify-center"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  "✓ Approve & Send"
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Approved — manual send option */}
      {narrative.status === "approved" && (
        <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground flex-1">Awaiting send at 9am</span>
          <button
            onClick={handleSendNow}
            disabled={loading}
            className="text-xs text-white bg-[#e94560] hover:bg-[#e94560]/90 rounded-[6px] px-4 py-1.5 transition-colors disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send Now"}
          </button>
        </div>
      )}
    </div>
  )
}
