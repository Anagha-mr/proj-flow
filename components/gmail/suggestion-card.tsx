"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { acceptAISuggestion, dismissAISuggestion } from "@/app/actions/gmail"
import { SuggestionEditSheet } from "./suggestion-edit-sheet"
import type { AISuggestion, AISuggestionClassification } from "@/app/actions/gmail"

const CLASSIFICATION_COLORS: Record<AISuggestionClassification, string> = {
  client_approval: "#1D9E75",
  vendor_quote: "#BA7517",
  contractor_query: "#E24B4A",
  invoice_query: "#BA7517",
  site_update: "rgba(255,255,255,0.35)",
  general: "rgba(255,255,255,0.20)",
}

const CLASSIFICATION_LABELS: Record<AISuggestionClassification, string> = {
  client_approval: "Client Approval",
  vendor_quote: "Vendor Quote",
  contractor_query: "Contractor Query",
  invoice_query: "Invoice Query",
  site_update: "Site Update",
  general: "General",
}

interface SuggestionCardProps {
  suggestion: AISuggestion
  onRemove: (id: string) => void
}

export function SuggestionCard({ suggestion, onRemove }: SuggestionCardProps) {
  const { toast } = useToast()
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [dismissLoading, setDismissLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const badgeColor = CLASSIFICATION_COLORS[suggestion.classification] ?? "rgba(255,255,255,0.20)"
  const badgeLabel = CLASSIFICATION_LABELS[suggestion.classification] ?? suggestion.classification

  async function handleAccept() {
    setAcceptLoading(true)
    onRemove(suggestion.id) // optimistic
    try {
      await acceptAISuggestion(suggestion.id)
      toast({ title: "Action applied successfully." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setAcceptLoading(false)
    }
  }

  async function handleDismiss() {
    setDismissLoading(true)
    onRemove(suggestion.id) // optimistic
    try {
      await dismissAISuggestion(suggestion.id)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setDismissLoading(false)
    }
  }

  return (
    <>
      <div
        className="rounded-[10px] p-4 mb-3"
        style={{
          background: "var(--color-surface, rgba(255,255,255,0.04))",
          border: "1px solid var(--color-border-default, rgba(255,255,255,0.10))",
        }}
      >
        {/* Sender row */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[12px]" style={{ color: "var(--color-text-secondary, rgba(255,255,255,0.55))" }}>
            📧 {suggestion.sender_name || suggestion.sender_email}
          </span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: badgeColor,
              color: "#fff",
              borderRadius: "20px",
            }}
          >
            {badgeLabel}
          </span>
        </div>

        {/* Subject */}
        {suggestion.email_subject && (
          <p
            className="text-[13px] font-medium truncate mb-1"
            style={{ color: "var(--color-text-primary, inherit)" }}
          >
            {suggestion.email_subject}
          </p>
        )}

        {/* Snippet */}
        {suggestion.email_snippet && (
          <p
            className="text-[13px] line-clamp-2 mb-3"
            style={{ color: "var(--color-text-secondary, rgba(255,255,255,0.55))" }}
          >
            {suggestion.email_snippet}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAccept}
            disabled={acceptLoading}
            className="inline-flex items-center gap-1 px-3 h-7 rounded-[6px] text-[12px] font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-accent, #e94560)", color: "#fff", minHeight: 44 }}
          >
            {acceptLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Accept
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center h-7 px-3 rounded-[6px] text-[12px] font-medium border transition-opacity"
            style={{
              border: "1px solid var(--color-border-default, rgba(255,255,255,0.15))",
              color: "var(--color-text-primary, inherit)",
              background: "transparent",
              minHeight: 44,
            }}
          >
            Edit
          </button>
          <button
            onClick={handleDismiss}
            disabled={dismissLoading}
            className="inline-flex items-center h-7 px-3 rounded-[6px] text-[12px] transition-opacity disabled:opacity-50"
            style={{
              color: "var(--color-text-secondary, rgba(255,255,255,0.40))",
              background: "transparent",
              minHeight: 44,
            }}
          >
            {dismissLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Dismiss
          </button>
        </div>
      </div>

      <SuggestionEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        suggestion={suggestion}
        onAccepted={() => onRemove(suggestion.id)}
      />
    </>
  )
}
