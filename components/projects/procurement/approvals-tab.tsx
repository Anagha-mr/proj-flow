"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package } from "lucide-react"
import {
  getAllItemsForApprovals,
  getSchedules,
  type ProcurementItem,
  type ProcurementSchedule,
} from "@/app/actions/procurement"
import { ItemDetailPanel } from "./item-detail-panel"
import { useToast } from "@/hooks/use-toast"

interface ApprovalsTabProps {
  projectId: string
  userRole: string
}

type ApprovalFilter = "all" | "client_review" | "approved" | "rejected" | "resubmit" | "closed"

const FILTER_LABELS: Record<ApprovalFilter, string> = {
  all: "All",
  client_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  resubmit: "Revision Requested",
  closed: "Closed",
}

const CLIENT_BADGE: Record<string, { label: string; className: string }> = {
  client_review: { label: "Pending",   className: "bg-amber-100 text-amber-700" },
  approved:      { label: "Approved",  className: "bg-green-100 text-green-700" },
  rejected:      { label: "Rejected",  className: "bg-red-100 text-red-700" },
  resubmit:      { label: "Revision",  className: "bg-orange-100 text-orange-700" },
  closed:        { label: "Closed",    className: "bg-slate-100 text-slate-600" },
}

const CURATION_BADGE: Record<string, { label: string; className: string }> = {
  draft:               { label: "Draft",               className: "bg-slate-100 text-slate-600" },
  hidden:              { label: "Hidden",              className: "bg-gray-100 text-gray-500" },
  quoting:             { label: "Quoting",             className: "bg-amber-100 text-amber-700" },
  selected:            { label: "Selected",            className: "bg-blue-100 text-blue-700" },
  internal_review:     { label: "Internal Review",     className: "bg-orange-100 text-orange-700" },
  internally_approved: { label: "Internally Approved", className: "bg-green-100 text-green-700" },
}

const PROCUREMENT_BADGE: Record<string, { label: string; className: string }> = {
  ordered:       { label: "Ordered",       className: "bg-blue-100 text-blue-700" },
  in_production: { label: "In Production", className: "bg-amber-100 text-amber-700" },
  in_transit:    { label: "In Transit",    className: "bg-orange-100 text-orange-700" },
  delivered:     { label: "Delivered",     className: "bg-green-100 text-green-700" },
  installed:     { label: "Installed",     className: "bg-teal-100 text-teal-700" },
}

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  invoiced:        { label: "Invoiced",        className: "bg-slate-100 text-slate-600" },
  payment_due:     { label: "Payment Due",     className: "bg-amber-100 text-amber-700" },
  partial_payment: { label: "Partial Payment", className: "bg-orange-100 text-orange-700" },
  paid:            { label: "Paid",            className: "bg-green-100 text-green-700" },
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

export function ApprovalsTab({ projectId, userRole }: ApprovalsTabProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [schedules, setSchedules] = useState<ProcurementSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ApprovalFilter>("all")
  const [scheduleFilter, setScheduleFilter] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<ProcurementItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemData, scheduleData] = await Promise.all([
        getAllItemsForApprovals(projectId),
        getSchedules(projectId),
      ])
      setItems(itemData)
      setSchedules(scheduleData)
    } catch {
      toast({ title: "Failed to load approval items", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => { load() }, [load])

  const filtered = items.filter((item) => {
    const matchesStatus = filter === "all" || item.status?.client_approval_status === filter
    const matchesSchedule = scheduleFilter === "all" || item.schedule_id === scheduleFilter
    return matchesStatus && matchesSchedule
  })

  const totalItems = filtered.length
  const totalCost = filtered.reduce((sum, i) => sum + i.total_cost, 0)
  const approvedCount = filtered.filter((i) => i.status?.client_approval_status === "approved").length
  const pendingCount = filtered.filter((i) => i.status?.client_approval_status === "client_review").length

  function getScheduleName(scheduleId: string) {
    return schedules.find((s) => s.id === scheduleId)?.name ?? "Unknown Schedule"
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {(Object.entries(FILTER_LABELS) as [ApprovalFilter, string][]).map(([val, label]) => (
            <Button
              key={val}
              variant={filter === val ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(val)}
              className={`text-xs h-7 px-3 ${filter === val ? "bg-[#1a1a2e] text-white" : ""}`}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="hidden sm:block ml-auto">
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="h-7 text-xs w-40 focus:ring-[#e94560]">
              <SelectValue placeholder="All Schedules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              {schedules.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="text-sm text-muted-foreground border-b pb-3">
          <span className="font-medium text-foreground">{totalItems}</span> items ·{" "}
          <span className="font-medium text-foreground">{formatINR(totalCost)}</span> ·{" "}
          <span className="text-green-600 font-medium">{approvedCount} approved</span> ·{" "}
          <span className="text-amber-600 font-medium">{pendingCount} pending</span>
        </div>
      )}

      {/* Item list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-3 flex gap-3">
              <Skeleton className="w-10 h-10 rounded shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Package className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            No items {filter !== "all" ? `with status "${FILTER_LABELS[filter]}"` : ""}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            const clientMeta = item.status?.client_approval_status
              ? CLIENT_BADGE[item.status.client_approval_status]
              : null
            const curationMeta = item.status?.curation_status
              ? CURATION_BADGE[item.status.curation_status]
              : null
            const procurementMeta = item.status?.procurement_status
              ? PROCUREMENT_BADGE[item.status.procurement_status]
              : null
            const paymentMeta = item.status?.payment_status
              ? PAYMENT_BADGE[item.status.payment_status]
              : null

            return (
              <div
                key={item.id}
                className="border rounded-lg p-3 flex items-start gap-3 hover:border-[#e94560]/50 transition-colors cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + schedule */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <span className="text-xs text-muted-foreground">· {getScheduleName(item.schedule_id)}</span>
                  </div>

                  {/* Cost */}
                  <p className="text-xs text-muted-foreground mb-2">{formatINR(item.total_cost)}</p>

                  {/* Status badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {curationMeta && (
                      <Badge className={`text-xs px-1.5 py-0 ${curationMeta.className}`}>
                        {curationMeta.label}
                      </Badge>
                    )}
                    {clientMeta && (
                      <Badge className={`text-xs px-1.5 py-0 ${clientMeta.className}`}>
                        {clientMeta.label}
                      </Badge>
                    )}
                    {procurementMeta && (
                      <Badge className={`text-xs px-1.5 py-0 ${procurementMeta.className}`}>
                        {procurementMeta.label}
                      </Badge>
                    )}
                    {paymentMeta && (
                      <Badge className={`text-xs px-1.5 py-0 ${paymentMeta.className}`}>
                        {paymentMeta.label}
                      </Badge>
                    )}
                  </div>

                  {/* Client comment */}
                  {item.status?.client_comment && (
                    <div className="mt-2 bg-amber-50 rounded px-2 py-1">
                      <p className="text-xs text-amber-700 italic truncate">{item.status.client_comment}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Item Detail Panel */}
      {selectedItem && (
        <ItemDetailPanel
          open={!!selectedItem}
          onOpenChange={(open) => { if (!open) { setSelectedItem(null); load() } }}
          item={selectedItem}
          projectId={projectId}
          studioId=""
          userRole={userRole}
        />
      )}
    </div>
  )
}
