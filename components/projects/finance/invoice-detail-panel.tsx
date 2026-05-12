"use client"

import { useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { deletePayment, type Invoice, type InvoicePayment } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { RecordPaymentSheet } from "./record-payment-sheet"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: "Draft",   className: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    className: "bg-blue-100 text-blue-700" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700" },
  paid:    { label: "Paid",    className: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700" },
}

interface InvoiceDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  studioName: string
  studioGstin: string | null
  studioBankDetails: Record<string, string> | null
  onEdit: (inv: Invoice) => void
  onRecordPayment: (inv: Invoice) => void
  onRefresh: () => void
}

export function InvoiceDetailPanel({
  open,
  onOpenChange,
  invoice,
  studioName,
  studioGstin,
  studioBankDetails,
  onEdit,
  onRecordPayment,
  onRefresh,
}: InvoiceDetailPanelProps) {
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<InvoicePayment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)

  const statusMeta = STATUS_META[invoice.status] ?? STATUS_META.draft
  const payments = invoice.payments ?? []
  const isIntraState = (invoice.line_items ?? []).some((i) => i.cgst > 0)
  const totalCgst = (invoice.line_items ?? []).reduce((s, i) => s + i.cgst, 0)
  const totalSgst = (invoice.line_items ?? []).reduce((s, i) => s + i.sgst, 0)
  const totalIgst = (invoice.line_items ?? []).reduce((s, i) => s + i.igst, 0)

  async function handleDeletePayment() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePayment(deleteTarget.id)
      toast({ title: "Payment reversed" })
      setDeleteTarget(null)
      onRefresh()
    } catch {
      toast({ title: "Failed to reverse payment", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const canRecordPayment =
    invoice.status === "sent" || invoice.status === "partial" || invoice.status === "overdue"
  const canEdit = invoice.status === "draft"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[580px] overflow-y-auto bg-gray-50">
          {/* Paper-like invoice document */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6 mb-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-lg font-bold text-[#1a1a2e]">{studioName}</p>
                {studioGstin && (
                  <p className="text-xs text-muted-foreground mt-0.5">GSTIN: {studioGstin}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-[#1a1a2e] uppercase tracking-wide">Tax Invoice</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {invoice.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  Issued: {format(new Date(invoice.issue_date), "dd MMM yyyy")}
                </p>
                {invoice.due_date && (
                  <p className="text-xs text-muted-foreground">
                    Due: {format(new Date(invoice.due_date), "dd MMM yyyy")}
                  </p>
                )}
                <Badge className={`mt-1 text-xs px-2 py-0.5 ${statusMeta.className}`}>
                  {statusMeta.label}
                </Badge>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Bill To */}
            {invoice.client && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Bill To</p>
                <p className="text-sm font-medium">{invoice.client.name}</p>
                {invoice.client.email && (
                  <p className="text-xs text-muted-foreground">{invoice.client.email}</p>
                )}
              </div>
            )}

            {/* Line Items Table */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 pr-2 w-8">#</th>
                    <th className="text-left pb-2 pr-2">Description</th>
                    <th className="text-left pb-2 pr-2">HSN</th>
                    <th className="text-right pb-2 pr-2">Amount</th>
                    <th className="text-right pb-2 pr-2">GST%</th>
                    <th className="text-right pb-2">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.line_items ?? []).map((item, idx) => {
                    const tax = item.cgst + item.sgst + item.igst
                    return (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-1.5 pr-2 font-medium">{item.description}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">{item.hsn_code}</td>
                        <td className="py-1.5 pr-2 text-right">{formatINR(item.amount)}</td>
                        <td className="py-1.5 pr-2 text-right text-muted-foreground">{item.gst_rate}%</td>
                        <td className="py-1.5 text-right">{formatINR(tax)}</td>
                      </tr>
                    )
                  })}
                  {(invoice.line_items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-muted-foreground">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-5">
              <div className="w-60 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatINR(invoice.subtotal)}</span>
                </div>
                {isIntraState && totalCgst > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatINR(totalCgst)}</span>
                  </div>
                )}
                {isIntraState && totalSgst > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatINR(totalSgst)}</span>
                  </div>
                )}
                {!isIntraState && totalIgst > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatINR(totalIgst)}</span>
                  </div>
                )}
                <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatINR(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            {studioBankDetails && (
              <>
                <Separator className="mb-4" />
                <div className="text-xs">
                  <p className="font-semibold mb-1 text-muted-foreground uppercase">Bank Details</p>
                  {studioBankDetails.bank_name && (
                    <p>Bank: {studioBankDetails.bank_name}</p>
                  )}
                  {studioBankDetails.account_number && (
                    <p>A/c: {studioBankDetails.account_number}</p>
                  )}
                  {studioBankDetails.ifsc && (
                    <p>IFSC: {studioBankDetails.ifsc}</p>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">{invoice.notes}</p>
              </>
            )}

            <Separator className="my-4" />

            {/* Payment History */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Payment History</p>
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 text-xs">
                        <span className="font-medium">{formatINR(p.amount)}</span>
                        <span className="text-muted-foreground ml-2">
                          {format(new Date(p.payment_date), "dd MMM yyyy")}
                        </span>
                        {p.bank_reference && (
                          <span className="text-muted-foreground ml-2">· {p.bank_reference}</span>
                        )}
                      </div>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pb-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/finance/invoice-pdf?invoiceId=${invoice.id}`, "_blank")}
            >
              Download PDF
            </Button>
            {canRecordPayment && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPaymentSheetOpen(true)}
              >
                Record Payment
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                className="bg-[#e94560] hover:bg-[#c73652] text-white"
                onClick={() => onEdit(invoice)}
              >
                Edit
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Inline record payment sheet */}
      {paymentSheetOpen && (
        <RecordPaymentSheet
          open={paymentSheetOpen}
          onOpenChange={(v) => {
            setPaymentSheetOpen(v)
            if (!v) onRefresh()
          }}
          invoice={invoice}
          onRefresh={onRefresh}
        />
      )}

      {/* Delete payment confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will reverse the payment of{" "}
            <span className="font-medium text-foreground">
              {deleteTarget ? formatINR(deleteTarget.amount) : ""}
            </span>{" "}
            and update the invoice status.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={deleting}>
              {deleting ? "Reversing…" : "Reverse Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
