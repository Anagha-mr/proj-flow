"use client"

import { useState } from "react"
import { format } from "date-fns"
import type { WeeklyNarrative } from "@/app/actions/narratives"

const STATUS_BADGE: Record<
  WeeklyNarrative["status"],
  { label: string; className: string }
> = {
  sent: { label: "● Sent", className: "text-emerald-600 bg-emerald-50" },
  approved: { label: "✓ Approved", className: "text-blue-600 bg-blue-50" },
  skipped: { label: "— Skipped", className: "text-slate-500 bg-slate-100" },
  draft: { label: "Draft", className: "text-amber-600 bg-amber-50" },
  failed: { label: "✕ Failed", className: "text-red-600 bg-red-50" },
}

interface NarrativesHistoryClientProps {
  weeks: Array<[string, WeeklyNarrative[]]>
}

export function NarrativesHistoryClient({ weeks }: NarrativesHistoryClientProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {weeks.map(([weekStart, items]) => {
        const weekLabel = format(new Date(weekStart + "T00:00:00"), "d MMM yyyy")
        return (
          <div key={weekStart}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Week of {weekLabel}
            </h2>
            <div className="border border-border rounded-[10px] overflow-hidden">
              {items.map((narrative, idx) => {
                const badge = STATUS_BADGE[narrative.status]
                const isExpanded = expanded.has(narrative.id)
                const preview = narrative.final_text
                  ? narrative.final_text.slice(0, 80) + (narrative.final_text.length > 80 ? "…" : "")
                  : ""
                const projectName = narrative.project?.name ?? "Project"
                const clientName = narrative.client?.name ?? "Client"

                return (
                  <div key={narrative.id}>
                    {idx > 0 && <div className="border-t border-border" />}
                    <button
                      onClick={() => toggle(narrative.id)}
                      className="w-full flex items-center gap-3 px-4 h-12 text-left hover:bg-muted/30 transition-colors"
                    >
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {projectName}
                        {narrative.client && (
                          <span className="text-muted-foreground font-normal">
                            {" "}→ {clientName}
                          </span>
                        )}
                      </span>
                      {preview && !isExpanded && (
                        <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">
                          {preview}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>
                    {isExpanded && narrative.final_text && (
                      <div className="px-4 pb-4 pt-1 text-sm text-foreground leading-relaxed border-t border-border/50 bg-muted/10">
                        <p>{narrative.final_text}</p>
                        {narrative.sent_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Sent {format(new Date(narrative.sent_at), "d MMM yyyy, h:mm a")}
                          </p>
                        )}
                      </div>
                    )}
                    {isExpanded && narrative.status === "skipped" && (
                      <div className="px-4 pb-3 pt-1 border-t border-border/50 bg-muted/10">
                        <p className="text-xs text-muted-foreground">This update was skipped.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
