"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Lock, ChevronDown, ChevronRight } from "lucide-react"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { getScheduleSummary, getSchedulesForFinancial } from "@/app/actions/procurement"
import { useToast } from "@/hooks/use-toast"

interface FinancialTabProps {
  projectId: string
  userRole: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:       { label: "Draft",       className: "bg-slate-100 text-slate-600" },
  in_review:   { label: "In Review",   className: "bg-amber-100 text-amber-700" },
  approved:    { label: "Approved",    className: "bg-green-100 text-green-700" },
  ordered:     { label: "Ordered",     className: "bg-blue-100 text-blue-700" },
  delivered:   { label: "Delivered",   className: "bg-teal-100 text-teal-700" },
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

export function FinancialTab({ projectId, userRole }: FinancialTabProps) {
  const { toast } = useToast()
  const canView = hasPermission(userRole as StudioRole, "view_financials")
  const [summary, setSummary] = useState<{
    totalItems: number; totalCost: number; approvedItems: number; approvedCost: number; pendingApproval: number
  } | null>(null)
  const [schedules, setSchedules] = useState<Array<{
    id: string; name: string; status: string
    items: Array<{ name: string; total_cost: number; client_approval_status: string }>
  }>>([])
  const [loading, setLoading] = useState(true)
  const [markup, setMarkup] = useState(0)
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, schedulesData] = await Promise.all([
        getScheduleSummary(projectId),
        getSchedulesForFinancial(projectId),
      ])
      setSummary(summaryData)
      setSchedules(schedulesData)
    } catch {
      toast({ title: "Failed to load financial data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => { if (canView) load() }, [load, canView])

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Lock className="w-10 h-10 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">Financial Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">
            Financial details are visible to senior designers and above.
          </p>
        </div>
      </div>
    )
  }

  const markupMultiplier = 1 + markup / 100

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Trade Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatINR(summary.totalCost * markupMultiplier)}</p>
              {markup > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{formatINR(summary.totalCost)} + {markup}% markup</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Approved Items</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatINR(summary.approvedCost * markupMultiplier)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.approvedItems} items approved</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatINR((summary.totalCost - summary.approvedCost) * markupMultiplier)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{summary.pendingApproval} items pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Items Count</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalItems}</p>
              <p className="text-xs text-muted-foreground mt-1">across all schedules</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Markup & Tax section */}
      <div className="border rounded-lg p-4">
        <p className="text-sm font-semibold mb-3">Markup & Tax</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-muted-foreground">Studio Markup:</label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={200}
              value={markup}
              onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
              className="w-20 h-7 text-sm focus-visible:ring-[#e94560]"
            />
            <span className="text-sm">%</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Display only — does not change stored costs
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          GST note: Approved items will be pulled into the Project Finance tracker in Sprint 6.
        </p>
      </div>

      {/* Per-schedule breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Cost Breakdown by Schedule</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/procurement/pdf?projectId=${projectId}`, "_blank")}
          >
            Export PDF
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-3">
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No procurement schedules found</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <div className="col-span-2">Schedule</div>
              <div className="text-right">Items</div>
              <div className="text-right">Trade Total</div>
              <div className="text-right">Approved</div>
              <div className="text-center">Status</div>
            </div>

            {schedules.map((schedule) => {
              const scheduleTotal = schedule.items.reduce((sum, i) => sum + i.total_cost, 0)
              const approvedTotal = schedule.items
                .filter((i) => i.client_approval_status === "approved")
                .reduce((sum, i) => sum + i.total_cost, 0)
              const isExpanded = expandedSchedules.has(schedule.id)
              const statusMeta = STATUS_BADGE[schedule.status] ?? STATUS_BADGE.draft

              return (
                <div key={schedule.id} className="border-t">
                  <div
                    className="grid grid-cols-6 gap-2 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedSchedules((prev) => {
                      const next = new Set(prev)
                      if (next.has(schedule.id)) next.delete(schedule.id)
                      else next.add(schedule.id)
                      return next
                    })}
                  >
                    <div className="col-span-2 flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium">{schedule.name}</span>
                    </div>
                    <div className="text-right text-sm">{schedule.items.length}</div>
                    <div className="text-right text-sm font-medium">{formatINR(scheduleTotal * markupMultiplier)}</div>
                    <div className="text-right text-sm text-green-600">{formatINR(approvedTotal * markupMultiplier)}</div>
                    <div className="text-center">
                      <Badge className={`text-xs px-2 py-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                  </div>

                  {isExpanded && schedule.items.length > 0 && (
                    <div className="bg-muted/20 border-t">
                      {schedule.items.map((item, idx) => {
                        const isApproved = item.client_approval_status === "approved"
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-6 gap-2 px-8 py-2 border-t border-muted/50 text-xs"
                          >
                            <div className="col-span-2 text-muted-foreground truncate">{item.name}</div>
                            <div />
                            <div className="text-right">{formatINR(item.total_cost * markupMultiplier)}</div>
                            <div className={`text-right ${isApproved ? "text-green-600" : "text-muted-foreground"}`}>
                              {isApproved ? formatINR(item.total_cost * markupMultiplier) : "—"}
                            </div>
                            <div className="text-center">
                              <Badge className={`text-xs px-1.5 py-0 ${isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {item.client_approval_status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
