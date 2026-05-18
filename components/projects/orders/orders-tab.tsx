"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, AlertTriangle, MoreHorizontal, Package } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { OrderTrackingRow, OrderSummary } from "@/app/actions/orders"
import type { Vendor } from "@/app/actions/vendors"
import { checkAndNotifyDelays } from "@/app/actions/orders"
import { OrderDetailPanel } from "./order-detail-panel"
import { ORDER_STATUS_BADGE, formatCurrency } from "@/components/vendors/vendor-utils"
import { differenceInDays, format } from "date-fns"
import { createClient } from "@/lib/supabase/client"

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'in_production', label: 'In Production' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'customs_hold', label: 'Customs Hold' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'installed', label: 'Installed' },
]

interface ProcurementItemOption {
  id: string
  name: string
  vendor_id: string | null
  image_url: string | null
  total_cost: number | null
}

interface OrdersTabProps {
  orderTracking: OrderTrackingRow[]
  orderSummary: OrderSummary
  vendors: Vendor[]
  projectId: string
}

export function OrdersTab({ orderTracking: initialTracking, orderSummary: initialSummary, vendors, projectId }: OrdersTabProps) {
  const [orders, setOrders] = useState<OrderTrackingRow[]>(initialTracking)
  const [summary, setSummary] = useState<OrderSummary>(initialSummary)
  const [statusFilter, setStatusFilter] = useState("")
  const [panelOpen, setPanelOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OrderTrackingRow | null>(null)
  const [allItems, setAllItems] = useState<ProcurementItemOption[]>([])

  // Fire-and-forget delay check on mount
  useEffect(() => {
    try { checkAndNotifyDelays(projectId).catch(() => {}) } catch { /* silent */ }
  }, [projectId])

  // Fetch procurement items for the create form
  useEffect(() => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from as any)("procurement_items")
      .select("id, name, supplier_id, image_url, total_cost")
      .eq("project_id", projectId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        setAllItems((data ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          vendor_id: i.supplier_id ?? null,
          image_url: i.image_url ?? null,
          total_cost: i.total_cost ?? null,
        })))
      })
  }, [projectId])

  const trackedItemIds = new Set(orders.map((o) => o.procurement_item_id))
  const untracked = allItems.filter((i) => !trackedItemIds.has(i.id))

  const today = new Date().toISOString().split('T')[0]
  const filtered = orders.filter((o) => !statusFilter || o.status === statusFilter)

  function handleOrderSaved(saved: OrderTrackingRow) {
    setOrders((prev) => {
      const exists = prev.find((o) => o.id === saved.id)
      if (exists) return prev.map((o) => o.id === saved.id ? saved : o)
      return [...prev, saved]
    })
    // Recalculate summary client-side (approximate)
    setSummary((prev) => ({
      ...prev,
      total_orders: prev.total_orders + 1,
    }))
  }

  function handleOrderDeleted(id: string) {
    setOrders((prev) => {
      const removed = prev.find((o) => o.id === id)
      const next = prev.filter((o) => o.id !== id)
      setSummary((s) => ({
        ...s,
        total_orders: s.total_orders - 1,
        delivered: removed?.status === 'delivered' || removed?.status === 'installed' ? s.delivered - 1 : s.delivered,
      }))
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: summary.total_orders, red: false },
          { label: 'Delivered', value: summary.delivered, red: false },
          { label: 'In Transit', value: summary.in_transit, red: false },
          { label: 'Delayed', value: summary.delayed, red: summary.delayed > 0 },
        ].map((chip) => (
          <div key={chip.label} className={`rounded-xl border p-4 ${chip.red && chip.value > 0 ? 'border-red-200 bg-red-50' : 'bg-white'}`}>
            <p className="text-xs text-muted-foreground">{chip.label}</p>
            <p className={`text-2xl font-bold ${chip.red && chip.value > 0 ? 'text-red-600' : ''}`}>{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Header + filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${statusFilter === f.value ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'text-muted-foreground border-gray-200 hover:border-gray-400'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setEditOrder(null); setPanelOpen(true) }} className="bg-[#e94560] hover:bg-[#c73652]">
          <Plus className="w-4 h-4 mr-1" /> Track Order
        </Button>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl gap-3 text-center">
          <Package className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No orders tracked yet. Use + Track Order to log delivery details for approved procurement items.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => {
            const badge = ORDER_STATUS_BADGE[order.status] ?? ORDER_STATUS_BADGE.ordered
            const isDelayed =
              order.expected_delivery_date &&
              order.expected_delivery_date < today &&
              order.status !== 'delivered' &&
              order.status !== 'installed'
            const daysLate = isDelayed
              ? differenceInDays(new Date(), new Date(order.expected_delivery_date!))
              : 0

            return (
              <div key={order.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {order.item_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.item_image_url} alt={order.item_name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{order.item_name}</p>
                        <p className="text-xs text-muted-foreground">{order.vendor_name ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 hover:bg-muted rounded">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditOrder(order); setPanelOpen(true) }}>Edit</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => { setEditOrder(order); setPanelOpen(true) }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-muted-foreground">
                      {order.order_number && <span>Order: {order.order_number}</span>}
                      {order.expected_delivery_date && (
                        <span>Expected: {format(new Date(order.expected_delivery_date), 'd MMM yyyy')}</span>
                      )}
                      {order.actual_delivery_date && (
                        <span>Delivered: {format(new Date(order.actual_delivery_date), 'd MMM yyyy')}</span>
                      )}
                      {order.item_total_cost !== null && order.item_total_cost !== undefined && (
                        <span>{formatCurrency(order.item_total_cost)}</span>
                      )}
                    </div>

                    {isDelayed && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Delayed by {daysLate} day{daysLate !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <OrderDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        order={editOrder}
        projectId={projectId}
        untracked={untracked}
        vendors={vendors}
        onSaved={handleOrderSaved}
        onDeleted={handleOrderDeleted}
      />
    </div>
  )
}
