"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { recordPayment, deletePayment, type Invoice, type InvoicePayment } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

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

interface RecordPaymentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  onRefresh: () => void
}

export function RecordPaymentSheet({
  open,
  onOpenChange,
  invoice,
  onRefresh,
}: RecordPaymentSheetProps) {
  const { toast } = useToast()
  const amountDue = invoice.amount_due ?? 0

  const [amount, setAmount] = useState(amountDue > 0 ? String(amountDue) : "")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [bankReference, setBankReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InvoicePayment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const statusMeta = STATUS_META[invoice.status] ?? STATUS_META.draft

  async function handleRecord() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await recordPayment({
        invoiceId: invoice.id,
        amount: amt,
        paymentDate,
        bankReference: bankReference || undefined,
        notes: notes || undefined,
      })
      toast({ title: `Payment of ${formatINR(amt)} recorded` })
      setAmount("")
      setBankReference("")
      setNotes("")
      onRefresh()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to record payment", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePayment(deleteTarget.id)
      toast({ title: "Payment reversed" })
      setDeleteTarget(null)
      onRefresh()
    } catch {
      toast({ title: "Failed to delete payment", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const payments = invoice.payments ?? []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[440px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <SheetTitle>{invoice.invoice_number}</SheetTitle>
              <Badge className={`text-xs px-2 py-0.5 ${statusMeta.className}`}>
                {statusMeta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatINR(amountDue)} outstanding
            </p>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-5">
            {/* Amount */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Amount *</label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            {/* Payment Date */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment Date *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            {/* Bank Reference */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Bank Reference / Transaction ID</label>
              <Input
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="NEFT/RTGS/UPI reference"
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="focus-visible:ring-[#e94560]"
              />
            </div>

            <Button
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={handleRecord}
              disabled={saving}
            >
              {saving ? "Recording…" : "Record Payment"}
            </Button>

            <Separator />

            {/* Payment History */}
            <div>
              <p className="text-sm font-semibold mb-3">Payment History</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{formatINR(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.payment_date), "dd MMM yyyy")}
                          {p.bank_reference && ` · ${p.bank_reference}`}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
