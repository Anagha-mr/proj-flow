"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Package, CheckCircle, XCircle, RotateCcw } from "lucide-react"
import { getSchedulePublic, clientApproveItem, type ProcurementItem, type ProcurementSchedule, type ClientApprovalStatus } from "@/app/actions/procurement"

const CLIENT_BADGE: Record<string, { label: string; className: string }> = {
  client_review: { label: "Awaiting Approval", className: "bg-amber-100 text-amber-700" },
  approved:      { label: "Approved",           className: "bg-green-100 text-green-700" },
  rejected:      { label: "Declined",           className: "bg-red-100 text-red-700" },
  resubmit:      { label: "Revision Requested", className: "bg-orange-100 text-orange-700" },
  closed:        { label: "Closed",             className: "bg-slate-100 text-slate-600" },
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

function groupItems(items: ProcurementItem[]): Record<string, ProcurementItem[]> {
  const groups: Record<string, ProcurementItem[]> = {}
  for (const item of items) {
    const key = item.room_or_category || "Uncategorised"
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

type ActionState = "idle" | "loading" | "done"

function ApprovalButtons({
  item,
  portalToken,
  canApprove,
  onActionDone,
}: {
  item: ProcurementItem
  portalToken: string
  canApprove: boolean
  onActionDone: (itemId: string, newStatus: string, comment?: string) => void
}) {
  const [action, setAction] = useState<"approved" | "rejected" | "resubmit" | null>(null)
  const [comment, setComment] = useState("")
  const [state, setState] = useState<ActionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const currentStatus = item.status?.client_approval_status ?? "client_review"

  if (!canApprove || currentStatus === "closed") return null

  async function handleSubmit() {
    if (!action) return
    if ((action === "rejected" || action === "resubmit") && !comment.trim()) {
      setError("A comment is required")
      return
    }
    setState("loading")
    setError(null)
    try {
      await clientApproveItem({
        itemId: item.id,
        projectPortalToken: portalToken,
        action,
        comment: comment.trim() || undefined,
      })
      onActionDone(item.id, action, comment.trim() || undefined)
      setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
      setState("idle")
    }
  }

  if (state === "done") {
    return (
      <div className="mt-3 text-sm text-green-600 font-medium">
        ✓ {action === "approved" ? "Approved" : action === "rejected" ? "Declined" : "Revision requested"}
      </div>
    )
  }

  if (currentStatus === "approved") {
    return (
      <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span>Approved</span>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {action ? (
        <div className="flex flex-col gap-2">
          {(action === "rejected" || action === "resubmit") && (
            <Textarea
              placeholder="Your comment (required)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="text-sm"
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={state === "loading"}
              className={
                action === "approved"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : action === "rejected"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }
            >
              {state === "loading" ? "Submitting…" : "Confirm"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAction(null); setComment(""); setError(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
            onClick={() => setAction("approved")}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 text-xs h-7"
            onClick={() => setAction("resubmit")}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Request Revision
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 text-xs h-7"
            onClick={() => setAction("rejected")}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Decline
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ProcurementSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const searchParams = useSearchParams()
  const portalToken = searchParams.get("token") ?? ""

  const [schedule, setSchedule] = useState<ProcurementSchedule | null>(null)
  const [items, setItems] = useState<ProcurementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getSchedulePublic(token)
      .then((data) => {
        if (!data) { setNotFound(true); return }
        setSchedule(data.schedule)
        setItems(data.items)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  function handleActionDone(itemId: string, newStatus: string, comment?: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: i.status
                ? {
                    ...i.status,
                    client_approval_status: newStatus as ClientApprovalStatus,
                    client_comment: comment ?? i.status.client_comment,
                  }
                : i.status,
            }
          : i
      )
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading schedule…</p>
      </div>
    )
  }

  if (notFound || !schedule) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <XCircle className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">Link not available</p>
          <p className="text-sm text-muted-foreground mt-1">
            This link has expired or is invalid. Please contact your designer for a new link.
          </p>
        </div>
      </div>
    )
  }

  const grouped = groupItems(items)
  const totalCost = items.reduce((sum, i) => sum + i.total_cost, 0)
  const approvedCount = items.filter((i) => i.status?.client_approval_status === "approved").length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-4 py-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Procurement Schedule</p>
          <h1 className="text-xl font-bold">{schedule.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-white/70 flex-wrap">
            <span>{items.length} items</span>
            {schedule.client_can_view_pricing && (
              <>
                <span>·</span>
                <span>{formatINR(totalCost)} total</span>
                <span>·</span>
                <span className="text-green-400">{approvedCount} approved</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No items in this schedule</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([groupName, groupItems]) => (
              <div key={groupName}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {groupName}
                </h2>
                <div className="flex flex-col gap-3">
                  {groupItems.map((item) => {
                    const approvalStatus = item.status?.client_approval_status ?? "client_review"
                    const badge = CLIENT_BADGE[approvalStatus]

                    return (
                      <div key={item.id} className="bg-white rounded-xl border shadow-sm p-4">
                        <div className="flex gap-3">
                          {/* Thumbnail */}
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Name + status */}
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm">{item.name}</p>
                              <Badge className={`text-xs px-2 py-0 shrink-0 ${badge.className}`}>
                                {badge.label}
                              </Badge>
                            </div>

                            {/* Description */}
                            {item.description && schedule.client_can_view_details && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                              {schedule.client_can_view_brand && item.brand && (
                                <span>Brand: {item.brand}</span>
                              )}
                              {schedule.client_can_view_supplier && item.supplier_name && (
                                <span>Supplier: {item.supplier_name}</span>
                              )}
                              <span>Qty: {item.quantity}</span>
                              {schedule.client_can_view_pricing && (
                                <span className="font-semibold text-foreground">
                                  {formatINR(item.total_cost)}
                                </span>
                              )}
                            </div>

                            {/* Client comment */}
                            {item.status?.client_comment && (
                              <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2">
                                <p className="text-xs text-amber-700 italic">{item.status.client_comment}</p>
                              </div>
                            )}

                            {/* Approval buttons */}
                            {portalToken && (
                              <ApprovalButtons
                                item={item}
                                portalToken={portalToken}
                                canApprove={schedule.client_can_approve}
                                onActionDone={handleActionDone}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-muted-foreground border-t mt-8">
        Powered by <span className="font-semibold">ProjectFlow</span>
      </div>
    </div>
  )
}
