"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { NarrativeReviewCard } from "./narrative-review-card"
import { generateAllNarratives } from "@/app/actions/narratives"
import type { WeeklyNarrative } from "@/app/actions/narratives"
import { getMonday } from "@/lib/utils/date"

interface NarrativesDashboardSectionProps {
  initialNarratives: WeeklyNarrative[]
  userRole: string
}

export function NarrativesDashboardSection({
  initialNarratives,
  userRole,
}: NarrativesDashboardSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [narratives, setNarratives] = useState(initialNarratives)
  const [generating, setGenerating] = useState(false)

  const isMonday = new Date().getDay() === 1
  const hasDrafts = narratives.some((n) => n.status === "draft")
  const canGenerate = userRole === "owner" || userRole === "senior_designer"

  // Only show section on Mondays or when there are pending drafts
  if (!isMonday && !hasDrafts) return null

  // Count how many active projects need a narrative
  const weekStart = getMonday(new Date())
  void weekStart // used in generateAllNarratives

  const visibleNarratives = narratives.filter(
    (n) => n.status === "draft" || n.status === "approved"
  )

  function handleStatusChange(id: string, status: WeeklyNarrative["status"]) {
    setNarratives((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status } : n))
    )
  }

  async function handleGenerateAll() {
    setGenerating(true)
    try {
      await generateAllNarratives()
      toast({ title: "Narratives generated — refresh to see them" })
      router.refresh()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Weekly Client Updates</h2>
          {hasDrafts ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {narratives.filter((n) => n.status === "draft").length} update
              {narratives.filter((n) => n.status === "draft").length !== 1 ? "s" : ""} ready for review
            </p>
          ) : (
            <p className="text-xs text-emerald-600 mt-0.5">
              No updates pending — all clients are up to date ✓
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="text-xs border border-border rounded-[6px] px-3 py-1.5 text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {generating ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate All"
              )}
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard/narratives")}
            className="text-xs border border-border rounded-[6px] px-3 py-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            History
          </button>
        </div>
      </div>

      {/* Cards */}
      {visibleNarratives.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visibleNarratives.map((narrative) => (
            <NarrativeReviewCard
              key={narrative.id}
              narrative={narrative}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : isMonday && !generating ? (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-[10px]">
          {canGenerate
            ? 'Click "Generate All" to create this week\'s client updates.'
            : "No client updates ready for review yet."}
        </div>
      ) : null}
    </section>
  )
}
