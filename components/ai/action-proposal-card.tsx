"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { format } from "date-fns"

function safeDateFormat(dateStr: string | null): string {
  if (!dateStr) return 'No due date'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return format(d, 'dd MMM yyyy')
}
import { confirmAction, dismissAction } from "@/app/actions/ai"
import type {
  ActionProposal,
  CreateTaskPayload,
  SendWhatsAppPayload,
  UpdateTaskStatusPayload,
  CreateMeetingNotePayload,
} from "@/app/actions/ai"

interface ActionProposalCardProps {
  proposal: ActionProposal
  conversationId: string
  messageTimestamp: string
  onConfirmed: () => void
  onDismissed: () => void
}

export function ActionProposalCard({
  proposal,
  conversationId,
  messageTimestamp,
  onConfirmed,
  onDismissed,
}: ActionProposalCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [localStatus, setLocalStatus] = useState(proposal.status)

  async function handleConfirm() {
    setConfirming(true)
    try {
      await confirmAction(conversationId, messageTimestamp, proposal)
      setLocalStatus("confirmed")
      onConfirmed()
    } catch (err) {
      console.error("Failed to confirm action:", err)
    } finally {
      setConfirming(false)
    }
  }

  async function handleDismiss() {
    setDismissing(true)
    try {
      await dismissAction(conversationId, messageTimestamp)
      setLocalStatus("dismissed")
      onDismissed()
    } catch (err) {
      console.error("Failed to dismiss action:", err)
    } finally {
      setDismissing(false)
    }
  }

  return (
    <div
      className={`bg-accent/5 border border-accent/20 rounded-[8px] p-3 mt-2 transition-opacity ${
        localStatus === "dismissed" ? "opacity-40" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1 mb-1">
        <Sparkles className="w-[10px] h-[10px] text-accent" />
        <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">
          Proposed Action
        </span>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-text-primary mb-1">{proposal.display_label}</p>

      {/* Details line */}
      <ProposalDetails proposal={proposal} />

      {/* Status / Buttons */}
      {localStatus === "confirmed" ? (
        <p className="text-[#1D9E75] text-xs font-medium mt-2">Done — action completed</p>
      ) : localStatus === "dismissed" ? (
        <p className="text-text-muted text-xs mt-2">Dismissed</p>
      ) : (
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleDismiss}
            disabled={dismissing || confirming}
            className="text-xs text-text-muted hover:text-text-primary border border-border-default rounded-[6px] px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {dismissing ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "✕ Dismiss"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || dismissing}
            className="text-xs text-white bg-accent hover:bg-accent/90 rounded-[6px] px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {confirming ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "✓ Confirm"}
          </button>
        </div>
      )}
    </div>
  )
}

function ProposalDetails({ proposal }: { proposal: ActionProposal }) {
  switch (proposal.type) {
    case "create_task": {
      const p = proposal.payload as CreateTaskPayload
      return (
        <p className="text-xs text-text-muted">
          Due: {safeDateFormat(p.due_date)} · Priority: {p.priority}
        </p>
      )
    }
    case "send_whatsapp": {
      const p = proposal.payload as SendWhatsAppPayload
      return (
        <div className="mt-1">
          <p className="text-xs text-text-muted mb-1">To: {p.recipient_name}</p>
          <pre className="text-xs text-text-muted bg-surface/50 rounded p-2 whitespace-pre-wrap break-words font-sans border border-border-default">
            {p.message_text.slice(0, 100)}{p.message_text.length > 100 ? "…" : ""}
          </pre>
        </div>
      )
    }
    case "update_task_status": {
      const p = proposal.payload as UpdateTaskStatusPayload
      return (
        <p className="text-xs text-text-muted">
          {p.task_title} → {p.new_status.replace("_", " ")}
        </p>
      )
    }
    case "create_meeting_note": {
      const p = proposal.payload as CreateMeetingNotePayload
      return (
        <p className="text-xs text-text-muted">
          {p.attendees.length} attendee{p.attendees.length !== 1 ? "s" : ""} ·{" "}
          {p.action_items.length} action item{p.action_items.length !== 1 ? "s" : ""}
        </p>
      )
    }
    default:
      return null
  }
}
