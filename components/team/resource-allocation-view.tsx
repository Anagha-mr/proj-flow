"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BusyBlock, ResourceConflict } from "@/app/actions/calendar"

interface ResourceAllocationViewProps {
  busyBlocks: BusyBlock[]
  conflicts: ResourceConflict[]
  teamMembers: { id: string; full_name: string; calendar_connected: boolean }[]
  weekStart: string
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })
}

function formatWeekLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const sLabel = s.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
  const eLabel = e.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
  return `${sLabel} – ${eLabel}`
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split("T")[0]
}

// Skeleton shimmer row
function SkeletonRow({ cols }: { cols: number }) {
  return (
    <div className="flex gap-0" style={{ minHeight: 44 }}>
      <div className="w-28 shrink-0 px-3 py-2">
        <div className="h-4 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
      </div>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1 px-1 py-2 flex items-center justify-center">
          <div className="h-6 w-full rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
      ))}
    </div>
  )
}

export function ResourceAllocationView({
  busyBlocks,
  conflicts,
  teamMembers,
  weekStart: initialWeekStart,
}: ResourceAllocationViewProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(initialWeekStart))
  const weekEnd = addDays(weekStart, 6)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  // Build lookup: userId → dateStr[] (dates that have busy blocks)
  const busyByUserAndDate = useMemo(() => {
    const map = new Map<string, Map<string, BusyBlock[]>>()
    for (const block of busyBlocks) {
      const date = block.start_at.split("T")[0]
      if (!map.has(block.user_id)) map.set(block.user_id, new Map())
      const dateMap = map.get(block.user_id)!
      if (!dateMap.has(date)) dateMap.set(date, [])
      dateMap.get(date)!.push(block)
    }
    return map
  }, [busyBlocks])

  function prevWeek() {
    setWeekStart((w) => addDays(w, -7))
  }

  function nextWeek() {
    setWeekStart((w) => addDays(w, 7))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Conflict banners */}
      {conflicts.length > 0 && (
        <div className="flex flex-col gap-2">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 rounded-lg text-[13px]"
              style={{
                borderLeft: "2px solid #BA7517",
                background: "rgba(226,75,74,0.08)",
              }}
            >
              <span style={{ color: "#BA7517" }}>⚠</span>
              <span className="text-foreground/80">
                <strong>{c.user_name}</strong> has a personal event on{" "}
                {new Date(c.conflict_date + "T00:00:00").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                — conflicts with{" "}
                <Link
                  href={`/dashboard/team?tab=availability`}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  {c.pf_event_title}
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prevWeek} aria-label="Previous week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium">
          Week of {formatWeekLabel(weekStart, weekEnd)}
        </span>
        <Button variant="outline" size="icon" onClick={nextWeek} aria-label="Next week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div
          className="rounded-lg min-w-[640px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Header row */}
          <div
            className="flex gap-0 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="w-28 shrink-0 px-3 py-2 text-[11px] text-muted-foreground font-medium">
              Member
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="flex-1 px-1 py-2 text-center text-[11px] text-muted-foreground font-medium"
              >
                {formatDayLabel(day)}
              </div>
            ))}
          </div>

          {/* Member rows */}
          {teamMembers.length === 0 ? (
            <>
              <SkeletonRow cols={7} />
              <SkeletonRow cols={7} />
              <SkeletonRow cols={7} />
            </>
          ) : (
            teamMembers.map((member, idx) => {
              const isLast = idx === teamMembers.length - 1
              const userDateMap = busyByUserAndDate.get(member.id)

              return (
                <div
                  key={member.id}
                  className="flex gap-0"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
                    minHeight: 44,
                  }}
                >
                  {/* Sticky member name */}
                  <div
                    className="w-28 shrink-0 px-3 py-2 flex items-center"
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "rgba(20,20,35,0.95)",
                      zIndex: 1,
                    }}
                  >
                    <span className="text-xs font-medium truncate">{member.full_name}</span>
                  </div>

                  {/* Day cells */}
                  {days.map((day) => {
                    const blocks = userDateMap?.get(day) ?? []
                    const hasBusy = blocks.length > 0
                    const isConnected = member.calendar_connected

                    if (!isConnected && !hasBusy) {
                      // Show "Not connected" on first day cell only
                      const isFirstDay = day === days[0]
                      return (
                        <div
                          key={day}
                          className="flex-1 px-1 py-2 flex items-center justify-center"
                        >
                          {isFirstDay && (
                            <span className="text-[10px] text-muted-foreground/40 truncate">
                              Not connected
                            </span>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={day}
                        className="flex-1 px-1 py-2 flex items-center justify-center"
                      >
                        {hasBusy && (
                          <div className="relative group w-full">
                            {blocks.map((block, bi) => (
                              <div
                                key={block.id}
                                className="h-6 rounded text-center flex items-center justify-center cursor-default"
                                style={{
                                  background: block.is_own
                                    ? "var(--color-accent, #e94560)"
                                    : "rgba(var(--color-accent-rgb, 233,69,96), 0.4)",
                                  marginBottom: bi < blocks.length - 1 ? 2 : 0,
                                }}
                                title={block.is_own && block.title ? block.title : "Busy"}
                              >
                                <span className="text-[10px] text-white/80 truncate px-1">
                                  {block.is_own && block.title ? block.title : "Busy"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
