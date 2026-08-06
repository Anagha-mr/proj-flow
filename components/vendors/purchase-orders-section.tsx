"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/PermissionGate"
import { AlertTriangle, Plus, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PurchaseOrder } from "@/app/actions/purchase-orders"
import type { Vendor } from "@/app/actions/vendors"
import { deletePurchaseOrder } from "@/app/actions/purchase-orders"
import { PODetailPanel } from "./po-detail-panel"
import { POEditorSheet } from "./po-editor-sheet"
import { PO_STATUS_BADGE, formatCurrency } from "./vendor-utils"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface PurchaseOrdersSectionProps {
  initialPOs: PurchaseOrder[]
  vendors: Vendor[]
  projects: Array<{ id: string; name: string; address_line1: string | null }>
  userRole: string
}

const ALL_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'confirmed_by_vendor', 'cancelled'] as const

export function PurchaseOrdersSection({ initialPOs, vendors, projects, userRole }: PurchaseOrdersSectionProps) {
  const { toast } = useToast()
  const [pos, setPOs] = useState<PurchaseOrder[]>(initialPOs)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [projectFilter, setProjectFilter] = useState("")
  const [vendorFilter, setVendorFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const isOwner = userRole === 'owner'
  const pendingApprovalCount = pos.filter((p) => p.status === 'pending_approval').length

  const filtered = pos.filter((po) => {
    if (projectFilter && po.project_id !== projectFilter) return false
    if (vendorFilter && po.vendor_id !== vendorFilter) return false
    if (statusFilter && po.status !== statusFilter) return false
    return true
  })

  function handlePOSaved(po: PurchaseOrder) {
    setPOs((prev) => {
      const exists = prev.find((p) => p.id === po.id)
      return exists ? prev.map((p) => p.id === po.id ? po : p) : [po, ...prev]
    })
  }

  function handlePOUpdated(updated: PurchaseOrder) {
    setPOs((prev) => prev.map((p) => p.id === updated.id ? updated : p))
    setSelectedPO(updated)
  }

  function handleEditPO(po: PurchaseOrder) {
    setSelectedPO(null)
    setEditingPO(po)
    setEditorOpen(true)
  }

  async function handleDelete(po: PurchaseOrder) {
    if (!confirm(`Delete ${po.po_number}?`)) return
    try {
      await deletePurchaseOrder(po.id)
      setPOs((prev) => prev.filter((p) => p.id !== po.id))
      toast({ title: "PO deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Purchase Orders</h2>
        <PermissionGate action="manage_purchase_orders">
          <Button size="sm" onClick={() => { setEditingPO(null); setEditorOpen(true) }} className="bg-[#e94560] hover:bg-[#c73652]">
            <Plus className="w-4 h-4 mr-1" /> Create PO
          </Button>
        </PermissionGate>
      </div>

      {/* Approval banner */}
      {isOwner && pendingApprovalCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {pendingApprovalCount} purchase order{pendingApprovalCount !== 1 ? 's' : ''} awaiting your approval
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select className="border rounded px-2 py-1 text-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {(['', ...ALL_STATUSES] as string[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter === s ? 'bg-[#e94560] text-white border-[#e94560]' : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-400'}`}
            >
              {s === '' ? 'All' : PO_STATUS_BADGE[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48 border border-dashed rounded-xl text-muted-foreground text-sm">
          No purchase orders yet. Create your first PO from a vendor&apos;s procurement items.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="pb-2 pr-4">PO Number</th>
                <th className="pb-2 pr-4">Vendor</th>
                <th className="pb-2 pr-4">Grand Total</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const badge = PO_STATUS_BADGE[po.status]
                return (
                  <tr
                    key={po.id}
                    className="border-b hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelectedPO(po)}
                  >
                    <td className="py-2.5 pr-4 font-medium">{po.po_number}</td>
                    <td className="py-2.5 pr-4">{po.vendor_name ?? '—'}</td>
                    <td className="py-2.5 pr-4">{formatCurrency(po.grand_total)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                        {po.status === 'pending_approval' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{format(new Date(po.po_date), 'd MMM yyyy')}</td>
                    <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-muted rounded"><MoreHorizontal className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedPO(po)}>View</DropdownMenuItem>
                          {['draft', 'pending_approval'].includes(po.status) && (
                            <DropdownMenuItem onClick={() => handleDelete(po)} className="text-red-600">Delete</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PODetailPanel
        po={selectedPO}
        userRole={userRole}
        onClose={() => setSelectedPO(null)}
        onUpdated={handlePOUpdated}
        onEdit={handleEditPO}
      />

      <POEditorSheet
        open={editorOpen}
        onOpenChange={(open) => { setEditorOpen(open); if (!open) setEditingPO(null) }}
        vendors={vendors}
        projects={projects}
        po={editingPO}
        onSaved={handlePOSaved}
      />
    </div>
  )
}
