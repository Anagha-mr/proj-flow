import type { Metadata } from "next"
import Link from "next/link"
import { getAllNarratives } from "@/app/actions/narratives"
import type { WeeklyNarrative } from "@/app/actions/narratives"
import { NarrativesHistoryClient } from "@/components/narratives/narratives-history-client"

export const metadata: Metadata = { title: "Weekly Updates History" }

export default async function NarrativesHistoryPage() {
  const narratives = await getAllNarratives().catch(() => [] as WeeklyNarrative[])

  // Group by week_start_date
  const grouped = new Map<string, WeeklyNarrative[]>()
  for (const n of narratives) {
    const week = n.week_start_date
    if (!grouped.has(week)) grouped.set(week, [])
    grouped.get(week)!.push(n)
  }
  const weeks = Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold text-foreground">Weekly Updates History</h1>
      </div>

      {/* History */}
      {weeks.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-[10px]">
          No narratives generated yet. They will appear here after the first Monday cron runs.
        </div>
      ) : (
        <NarrativesHistoryClient weeks={weeks} />
      )}
    </div>
  )
}
