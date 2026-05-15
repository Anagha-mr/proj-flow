"use client"

import { useState } from "react"
import { Clock, Users, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { TimeEntryRow } from "./time-entry-row"
import { LogTimeSheet } from "./log-time-sheet"
import { TimesheetStatusSheet } from "./timesheet-status-sheet"
import type { TimeEntry } from "@/app/actions/time-tracking"

interface TimeTabProps {
  project: { id: string; studio_id: string; name: string; phases: Array<{ name: string }> }
  initialEntries: TimeEntry[]
  currentUser: { id: string; name: string; role: string; hourly_rate: number | null }
  studioUsers: Array<{ id: string; name: string; role: string }>
}

export function TimeTab({ project, initialEntries, currentUser, studioUsers }: TimeTabProps) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [showLog, setShowLog] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [showTimesheet, setShowTimesheet] = useState(false)
  const [viewAll, setViewAll] = useState(false)

  const role = currentUser.role as StudioRole
  const canViewAll = hasPermission(role, "view_all_time_entries")
  const canViewFinancials = hasPermission(role, "view_financials")
  const canManageSpec = hasPermission(role, "manage_spec")

  const displayEntries = canViewAll && viewAll
    ? entries
    : entries.filter((e) => e.user_id === currentUser.id)

  function handleSaved(entry: TimeEntry) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = entry
        return next
      }
      return [entry, ...prev]
    })
  }

  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  // Summary computed from ALL entries (not filtered view)
  const total_hours = entries.reduce((s, e) => s + e.hours, 0)
  const billable_hours = entries.filter((e) => e.is_billable).reduce((s, e) => s + e.hours, 0)
  const total_cost = entries.reduce((s, e) => s + e.hours * e.hourly_rate_snapshot, 0)

  const monday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split("T")[0]
  })()
  const this_week = entries
    .filter((e) => e.entry_date >= monday)
    .reduce((s, e) => s + e.hours, 0)

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left column */}
      <div className="flex-[3] flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={() => { setEditEntry(null); setShowLog(true) }}
            >
              <Clock className="w-4 h-4 mr-1" /> Log Time
            </Button>
            {canViewAll && (
              <div className="flex rounded-lg border overflow-hidden text-sm">
                <button
                  className={`px-3 py-1.5 ${!viewAll ? "bg-[#1a1a2e] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => setViewAll(false)}
                >
                  My entries
                </button>
                <button
                  className={`px-3 py-1.5 ${viewAll ? "bg-[#1a1a2e] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => setViewAll(true)}
                >
                  All entries
                </button>
              </div>
            )}
          </div>
          {canViewAll && (
            <Button variant="outline" size="sm" onClick={() => setShowTimesheet(true)}>
              <Users className="w-4 h-4 mr-1" /> Timesheet Status
            </Button>
          )}
        </div>

        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl">
            <Clock className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No time logged yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Log your first hours.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayEntries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                entry={entry}
                canEdit={entry.user_id === currentUser.id || role === "owner"}
                canDelete={entry.user_id === currentUser.id || role === "owner"}
                onEdit={(e) => { setEditEntry(e); setShowLog(true) }}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="flex-[2] flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white rounded-lg shadow-sm border p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{total_hours.toFixed(1)}<span className="text-base font-normal">h</span></p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm border p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Billable Hours</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-green-700">{billable_hours.toFixed(1)}<span className="text-base font-normal">h</span></p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm border p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {canViewFinancials
                ? <p className="text-2xl font-bold">{formatCurrency(total_cost)}</p>
                : <p className="text-2xl font-bold text-muted-foreground">—</p>
              }
            </CardContent>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm border p-0">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{this_week.toFixed(1)}<span className="text-base font-normal">h</span></p>
            </CardContent>
          </Card>
        </div>

        {/* By-user breakdown */}
        {canViewAll && viewAll && (() => {
          const byUser: Record<string, { name: string; hours: number; cost: number }> = {}
          for (const e of entries) {
            const name = e.user?.name ?? "Unknown"
            if (!byUser[e.user_id]) byUser[e.user_id] = { name, hours: 0, cost: 0 }
            byUser[e.user_id].hours += e.hours
            byUser[e.user_id].cost += e.hours * e.hourly_rate_snapshot
          }
          const rows = Object.values(byUser)
          if (rows.length === 0) return null
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> By Team Member
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {rows.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{r.hours.toFixed(1)}h</span>
                      {canViewFinancials && <span className="text-muted-foreground text-xs">{formatCurrency(r.cost)}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })()}

        {/* By-phase breakdown */}
        {(() => {
          const byPhase: Record<string, number> = {}
          for (const e of (canViewAll && viewAll ? entries : entries.filter((e) => e.user_id === currentUser.id))) {
            const p = e.phase_tag ?? "Untagged"
            byPhase[p] = (byPhase[p] ?? 0) + e.hours
          }
          const rows = Object.entries(byPhase)
          if (rows.length === 0) return null
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4" /> By Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {rows.map(([phase, hrs]) => (
                  <div key={phase} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{phase}</span>
                    <span className="font-semibold">{hrs.toFixed(1)}h</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })()}
      </div>

      <LogTimeSheet
        open={showLog}
        onOpenChange={setShowLog}
        projectId={project.id}
        projectPhases={project.phases}
        currentUser={currentUser}
        editEntry={editEntry}
        onSaved={handleSaved}
      />

      {canViewAll && (
        <TimesheetStatusSheet open={showTimesheet} onOpenChange={setShowTimesheet} />
      )}
    </div>
  )
}
