"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Copy } from "lucide-react"
import type { PurchaseOrder } from "@/app/actions/purchase-orders"
import { approvePurchaseOrder, rejectPurchaseOrder, sendPurchaseOrder } from "@/app/actions/purchase-orders"
import { PO_STATUS_BADGE, formatCurrency } from "@/components/vendors/vendor-utils"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface PODetailPanelProps {
  po: PurchaseOrder | null
  userRole: string
  onClose: () => void
  onUpdated: (po: PurchaseOrder) => void
}

export function PODetailPanel({ po, userRole, onClose, onUpdated }: PODetailPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const isOwner = userRole === 'owner'

  async function handleApprove() {
    if (!po) return
    setLoading('approve')
    try {
      const updated = await approvePurchaseOrder(po.id)
      onUpdated(updated)
      toast({ title: "PO approved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    if (!po || !rejectReason.trim()) { toast({ title: "Provide a rejection reason", variant: "destructive" }); return }
    setLoading('reject')
    try {
      await rejectPurchaseOrder(po.id, rejectReason)
      onClose()
      toast({ title: "PO sent back to draft" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  async function handleSend() {
    if (!po) return
    setLoading('send')
    try {
      await sendPurchaseOrder(po.id)
      toast({ title: "PO sent to vendor" })
      onClose()
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  function copyLink() {
    if (!po) return
    navigator.clipboard.writeText(`${window.location.origin}/share/po/${po.id}`)
    toast({ title: "Link copied" })
  }

  const badge = po ? PO_STATUS_BADGE[po.status] : null

  return (
    <Sheet open={!!po} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[580px] overflow-y-auto">
        {po && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {po.po_number}
                {badge && <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>}
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-5 mt-5">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Vendor</span><span>{po.vendor_name ?? po.vendor_id}</span>
                <span className="text-muted-foreground">PO Date</span><span>{format(new Date(po.po_date), 'd MMM yyyy')}</span>
                {po.expected_delivery_date && (
                  <><span className="text-muted-foreground">Expected Delivery</span><span>{format(new Date(po.expected_delivery_date), 'd MMM yyyy')}</span></>
                )}
                {po.delivery_address && (
                  <><span className="text-muted-foreground">Delivery Address</span><span>{po.delivery_address}</span></>
                )}
              </div>

              <Separator />

              {/* Line items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Line Items</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-2">Item</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Unit Price</th>
                      <th className="pb-2">GST</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.line_items.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 pr-2">{item.name}</td>
                        <td className="py-2 pr-2">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                        <td className="py-2 pr-2">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2 pr-2">{item.gst_rate}%</td>
                        <td className="py-2 text-right">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col items-end gap-1 mt-3 text-sm">
                  <div className="flex gap-8"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(po.subtotal)}</span></div>
                  <div className="flex gap-8"><span className="text-muted-foreground">GST</span><span>{formatCurrency(po.gst_total)}</span></div>
                  <div className="flex gap-8 font-semibold border-t pt-1"><span>Grand Total</span><span>{formatCurrency(po.grand_total)}</span></div>
                </div>
              </div>

              {(po.payment_terms?.deposit_amount || po.payment_terms?.balance_amount) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Payment Terms</p>
                    <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                      {po.payment_terms.deposit_amount && (
                        <><span className="text-muted-foreground">Deposit</span><span>{formatCurrency(po.payment_terms.deposit_amount)}{po.payment_terms.deposit_due_date ? ` by ${format(new Date(po.payment_terms.deposit_due_date), 'd MMM yyyy')}` : ''}</span></>
                      )}
                      {po.payment_terms.balance_amount && (
                        <><span className="text-muted-foreground">Balance</span><span>{formatCurrency(po.payment_terms.balance_amount)}{po.payment_terms.balance_due_date ? ` by ${format(new Date(po.payment_terms.balance_due_date), 'd MMM yyyy')}` : ''}</span></>
                      )}
                    </div>
                  </div>
                </>
              )}

              {po.special_instructions && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Special Instructions</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.special_instructions}</p>
                  </div>
                </>
              )}

              {/* Timeline */}
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Timeline</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className={`px-2 py-1 rounded ${po.created_at ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                    Created: {format(new Date(po.created_at), 'd MMM yyyy')}
                  </div>
                  <div className={`px-2 py-1 rounded ${po.approved_at ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    Approved: {po.approved_at ? format(new Date(po.approved_at), 'd MMM yyyy') : '—'}
                  </div>
                  <div className={`px-2 py-1 rounded ${po.sent_at ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                    Sent: {po.sent_at ? format(new Date(po.sent_at), 'd MMM yyyy') : '—'}
                  </div>
                  <div className={`px-2 py-1 rounded ${po.vendor_confirmed_at ? 'bg-teal-50 text-teal-700' : 'bg-gray-50 text-gray-400'}`}>
                    Confirmed: {po.vendor_confirmed_at ? format(new Date(po.vendor_confirmed_at), 'd MMM yyyy') : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Reject reason input */}
            {isOwner && po.status === 'pending_approval' && (
              <div className="mt-4">
                <input
                  className="w-full border rounded p-2 text-sm"
                  placeholder="Rejection reason (required to reject)…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap gap-2 mt-6">
              {isOwner && po.status === 'pending_approval' && (
                <>
                  <Button size="sm" onClick={handleApprove} disabled={!!loading} className="bg-green-600 hover:bg-green-700">
                    {loading === 'approve' ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReject} disabled={!!loading || !rejectReason.trim()}>
                    {loading === 'reject' ? 'Rejecting…' : 'Reject'}
                  </Button>
                </>
              )}
              {po.status === 'approved' && (
                <Button size="sm" onClick={handleSend} disabled={!!loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading === 'send' ? 'Sending…' : 'Send to Vendor'}
                </Button>
              )}
              {(po.status === 'sent' || po.status === 'confirmed_by_vendor') && (
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy PO Link
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
