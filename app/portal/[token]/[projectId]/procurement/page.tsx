"use client"

import { useEffect, useState, useTransition } from "react"
import { getPortalProject } from "@/app/actions/client-portal"
import { clientApproveItem } from "@/app/actions/procurement"
import { useToast } from "@/hooks/use-toast"
import type { PortalFullProject } from "@/app/actions/client-portal"
import type { ProcurementItem, ProcurementSchedule } from "@/app/actions/procurement"

type PortalSchedule = PortalFullProject["procurement_schedules"][number]

interface ItemRowProps {
  item: ProcurementItem
  schedule: ProcurementSchedule
  token: string
}

function ItemRow({ item, schedule, token }: ItemRowProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState(item.status?.client_approval_status ?? "client_review")
  const [comment, setComment] = useState("")
  const [showComment, setShowComment] = useState<"resubmit" | "rejected" | null>(null)

  const canApprove = schedule.client_can_approve &&
    (localStatus === "client_review" || localStatus === "resubmit")

  async function handleAction(action: "approved" | "rejected" | "resubmit") {
    if ((action === "rejected" || action === "resubmit") && !comment.trim()) {
      setShowComment(action as "resubmit" | "rejected")
      return
    }
    startTransition(async () => {
      try {
        await clientApproveItem({ itemId: item.id, projectPortalToken: token, action, comment: comment || undefined })
        setLocalStatus(action)
        setShowComment(null)
        setComment("")
        toast({ title: action === "approved" ? "Item approved" : action === "resubmit" ? "Revision requested" : "Item declined" })
      } catch (err) {
        toast({ title: "Action failed", description: String(err), variant: "destructive" })
      }
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
      <div className="flex gap-3">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 object-cover rounded-md shrink-0 bg-gray-50"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">{item.name}</p>
              {item.product_code && (
                <p className="text-xs text-gray-400">{item.product_code}</p>
              )}
            </div>
            <StatusBadge status={localStatus} />
          </div>

          {item.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
            {schedule.client_can_view_brand && item.brand && (
              <span>Brand: <span className="font-medium">{item.brand}</span></span>
            )}
            {schedule.client_can_view_supplier && item.supplier_name && (
              <span>Supplier: <span className="font-medium">{item.supplier_name}</span></span>
            )}
            {schedule.client_can_view_pricing && (
              <span>Unit: <span className="font-medium">
                {item.unit_cost.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span></span>
            )}
            {schedule.client_can_view_details && item.finish && (
              <span>Finish: <span className="font-medium">{item.finish}</span></span>
            )}
          </div>

          {item.status?.client_comment && localStatus !== "approved" && (
            <p className="text-xs bg-amber-50 text-amber-700 rounded p-2 mt-2">{item.status.client_comment}</p>
          )}

          {canApprove && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleAction("approved")}
                  disabled={isPending}
                  className="min-h-[44px] px-4 py-2 text-sm bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => setShowComment("resubmit")}
                  disabled={isPending}
                  className="min-h-[44px] px-4 py-2 text-sm border border-amber-500 text-amber-700 rounded-md font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
                >
                  Request Revision
                </button>
                <button
                  onClick={() => setShowComment("rejected")}
                  disabled={isPending}
                  className="min-h-[44px] px-4 py-2 text-sm border border-red-500 text-red-600 rounded-md font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Decline
                </button>
              </div>
              {showComment && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={showComment === "resubmit" ? "What changes are needed?" : "Reason for declining"}
                    className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(showComment)}
                      disabled={isPending || !comment.trim()}
                      className="min-h-[44px] px-4 py-2 text-sm bg-[#1a1a2e] text-white rounded-md font-medium disabled:opacity-50 transition-colors"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => { setShowComment(null); setComment("") }}
                      className="min-h-[44px] px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    client_review: "bg-slate-100 text-slate-600",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    resubmit: "bg-amber-100 text-amber-700",
    closed: "bg-gray-100 text-gray-500",
  }
  const label: Record<string, string> = {
    client_review: "Pending",
    approved: "Approved",
    rejected: "Declined",
    resubmit: "Revision",
    closed: "Closed",
  }
  return (
    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? map.client_review}`}>
      {label[status] ?? status}
    </span>
  )
}

export default function PortalProcurementPage({
  params,
}: {
  params: { token: string; projectId: string }
}) {
  const { token, projectId } = params
  const { toast } = useToast()
  const [project, setProject] = useState<PortalFullProject | null>(null)
  const [scheduleItems, setScheduleItems] = useState<Record<string, ProcurementItem[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const p = await getPortalProject(token, projectId)
        setProject(p)

        // Fetch items for each published schedule
        if (p.procurement_schedules.length > 0) {
          const { getSchedulePublic } = await import("@/app/actions/procurement")
          const itemMap: Record<string, ProcurementItem[]> = {}
          for (const sched of p.procurement_schedules) {
            if (sched.share_token) {
              const result = await getSchedulePublic(sched.share_token)
              if (result) itemMap[sched.id] = result.items
            }
          }
          setScheduleItems(itemMap)
        }
      } catch (err) {
        toast({ title: "Failed to load procurement", description: String(err), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectId])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!project || project.procurement_schedules.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">
        No procurement schedules available for review.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <a href={`/portal/${token}/${projectId}`} className="text-[#e94560] text-sm hover:underline">
          ← {project.name}
        </a>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Procurement Approval</h1>

      {project.procurement_schedules.map((sched) => {
        const items = scheduleItems[sched.id] ?? []
        const fullSchedule = items[0] ? { ...sched, ...items[0] } : null

        // We need the full schedule object from getSchedulePublic
        const scheduleData = fullSchedule

        // Group items by room_or_category
        const grouped: Record<string, ProcurementItem[]> = {}
        items.forEach((item) => {
          const key = item.room_or_category ?? "Other"
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(item)
        })

        return (
          <div key={sched.id}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{sched.name}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">No items in this schedule.</p>
            ) : (
              Object.entries(grouped).map(([room, roomItems]) => (
                <div key={room} className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{room}</h3>
                  <div className="space-y-3">
                    {roomItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        schedule={sched as unknown as ProcurementSchedule}
                        token={token}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
