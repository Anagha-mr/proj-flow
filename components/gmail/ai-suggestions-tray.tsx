"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw } from "lucide-react"
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
import { dismissAllAISuggestions } from "@/app/actions/gmail"
import { SuggestionCard } from "./suggestion-card"
import { GmailConnectPrompt } from "./gmail-connect-prompt"
import type { AISuggestion } from "@/app/actions/gmail"

interface AISuggestionsTrayProps {
  suggestions: AISuggestion[]
  gmailConnected: boolean
  gmailAddress: string | null
}

function SkeletonCard() {
  return (
    <div
      className="rounded-[10px] p-4 mb-3 animate-pulse"
      style={{
        background: "var(--color-surface, rgba(255,255,255,0.04))",
        border: "1px solid var(--color-border-default, rgba(255,255,255,0.10))",
        height: 96,
      }}
    />
  )
}

export function AISuggestionsTray({
  suggestions: initialSuggestions,
  gmailConnected,
  gmailAddress,
}: AISuggestionsTrayProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<AISuggestion[]>(initialSuggestions)
  const [syncing, setSyncing] = useState(false)
  const [dismissingAll, startDismissAll] = useTransition()

  function handleRemove(id: string) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      toast({
        title:
          data.inserted > 0
            ? `Inbox synced — ${data.inserted} new suggestion${data.inserted === 1 ? "" : "s"}`
            : "Already up to date.",
      })
      router.refresh()
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  function handleDismissAll() {
    startDismissAll(async () => {
      try {
        await dismissAllAISuggestions()
        setSuggestions([])
        toast({ title: "All suggestions dismissed." })
      } catch (err) {
        toast({ title: String(err), variant: "destructive" })
      }
    })
  }

  // Hidden if Gmail not connected and no suggestions
  if (!gmailConnected && suggestions.length === 0) return null

  return (
    <div
      className="rounded-[10px] p-4"
      style={{
        background: "var(--color-card-bg, rgba(255,255,255,0.03))",
        border: "1px solid var(--color-border-default, rgba(255,255,255,0.10))",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-medium" style={{ color: "var(--color-text-primary, inherit)" }}>
            AI Suggestions
          </h2>
          {suggestions.length > 0 && (
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-accent, #e94560)",
                color: "#fff",
              }}
            >
              {suggestions.length} pending
            </span>
          )}
          {gmailAddress && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              — {gmailAddress}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {suggestions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="text-[12px] px-2 py-1 rounded-[6px] transition-colors"
                  style={{ color: "var(--color-text-secondary, rgba(255,255,255,0.40))" }}
                  disabled={dismissingAll}
                >
                  Dismiss all
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dismiss all suggestions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All {suggestions.length} pending AI suggestions will be dismissed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDismissAll}>
                    Dismiss all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {gmailConnected && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-[6px] border transition-colors"
              style={{
                border: "1px solid var(--color-border-default, rgba(255,255,255,0.15))",
                color: "var(--color-text-secondary, rgba(255,255,255,0.55))",
              }}
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </button>
          )}
        </div>
      </div>

      {/* Not connected state */}
      {!gmailConnected && <GmailConnectPrompt />}

      {/* Connected + no suggestions */}
      {gmailConnected && suggestions.length === 0 && (
        <p
          className="text-[13px] text-center py-4"
          style={{ color: "var(--color-text-secondary, rgba(255,255,255,0.40))" }}
        >
          No new suggestions — inbox is clear.
        </p>
      )}

      {/* Suggestion cards */}
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} onRemove={handleRemove} />
      ))}
    </div>
  )
}
