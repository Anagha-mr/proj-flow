"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, MoreHorizontal, FileText } from "lucide-react"
import { createInvoice, sendInvoice, deleteInvoice, type Invoice } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { InvoiceEditorSheet } from "./invoice-editor-sheet"
import { RecordPaymentSheet } from "./record-payment-sheet"
import { InvoiceDetailPanel } from "./invoice-detail-panel"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-slate-100 text-slate-600" },
  sent:     { label: "Sent",     className: "bg-blue-100 text-blue-700" },
  partial:  { label: "Partial",  className: "bg-amber-100 text-amber-700" },
  paid:     { label: "Paid",     className: "bg-green-100 text-green-700" },
  overdue:  { label: "Overdue",  className: "bg-red-100 text-red-700" },
}

interface InvoicesSectionProps {
  projectId: string
  invoices: Invoice[]
  loading: boolean
  studioStateCode: string
  clientStateCode: string
  studioName: string
  studioGstin: string | null
  studioBankDetails: Record<string, string> | null
  clientId: string
  onRefresh: () => void
}

export function InvoicesSection({
  projectId,
  invoices,
  loading,
  studioStateCode,
  clientStateCode,
  studioName,
  studioGstin,
  studioBankDetails,
  clientId,
  onRefresh,
}: InvoicesSectionProps) {
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [editorInvoice, setEditorInvoice] = useState<Invoice | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sendDialog, setSendDialog] = useState<Invoice | null>(null)
  const [sending, setSending] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      const inv = await createInvoice({ projectId, clientId })
      onRefresh()
      setEditorInvoice(inv)
      setEditorOpen(true)
    } catch {
      toast({ title: "Failed to create invoice", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleSend() {
    if (!sendDialog) return
    setSending(true)
    try {
      await sendInvoice(sendDialog.id)
      toast({ title: "Invoice sent to client" })
      setSendDialog(null)
      onRefresh()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to send", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!deleteDialog) return
    setDeleting(true)
    try {
      await deleteInvoice(deleteDialog.id)
      toast({ title: "Invoice deleted" })
      setDeleteDialog(null)
      onRefresh()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to delete", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  function openEditor(inv: Invoice) {
    setEditorInvoice(inv)
    setEditorOpen(true)
  }

  function openPayment(inv: Invoice) {
    setPaymentInvoice(inv)
    setPaymentOpen(true)
  }

  function openDetail(inv: Invoice) {
    setDetailInvoice(inv)
    setDetailOpen(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Invoices</h3>
        <Button
          size="sm"
          className="bg-[#e94560] hover:bg-[#c73652] text-white"
          onClick={handleCreate}
          disabled={creating}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {creating ? "Creating…" : "Create Invoice"}
        </Button>
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border rounded-lg">
          <FileText className="w-8 h-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first invoice to get started</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreate}
            disabled={creating}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Invoice
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv) => {
            const statusMeta = STATUS_META[inv.status] ?? STATUS_META.draft
            const isOverdue = inv.status === "overdue"

            return (
              <div
                key={inv.id}
                className="border rounded-lg p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => openDetail(inv)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{inv.invoice_number}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
                        {isOverdue && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {inv.client?.name && <span>{inv.client.name}</span>}
                      <span>Issued {format(new Date(inv.issue_date), "dd MMM yyyy")}</span>
                      {inv.due_date && <span>Due {format(new Date(inv.due_date), "dd MMM yyyy")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatINR(inv.total)}</p>
                      {inv.status !== "draft" && (
                        <div className="text-xs text-muted-foreground">
                          <span className="text-green-600">Paid {formatINR(inv.amount_paid ?? 0)}</span>
                          {(inv.amount_due ?? 0) > 0 && (
                            <span className="text-red-600 ml-2">Due {formatINR(inv.amount_due ?? 0)}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {inv.status === "draft" && (
                          <DropdownMenuItem onClick={() => openEditor(inv)}>
                            Edit
                          </DropdownMenuItem>
                        )}
                        {inv.status === "draft" && (
                          <DropdownMenuItem onClick={() => setSendDialog(inv)}>
                            Send Invoice
                          </DropdownMenuItem>
                        )}
                        {(inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && (
                          <DropdownMenuItem onClick={() => openPayment(inv)}>
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => window.open(`/api/finance/invoice-pdf?invoiceId=${inv.id}`, "_blank")}
                        >
                          Download PDF
                        </DropdownMenuItem>
                        {inv.status === "draft" && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteDialog(inv)}
                          >
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Invoice Editor Sheet */}
      {editorOpen && editorInvoice && (
        <InvoiceEditorSheet
          open={editorOpen}
          onOpenChange={(v) => {
            setEditorOpen(v)
            if (!v) onRefresh()
          }}
          invoice={editorInvoice}
          studioStateCode={studioStateCode}
          clientStateCode={clientStateCode}
          onRefresh={onRefresh}
          onSend={(inv) => {
            setEditorOpen(false)
            setSendDialog(inv)
          }}
        />
      )}

      {/* Record Payment Sheet */}
      {paymentOpen && paymentInvoice && (
        <RecordPaymentSheet
          open={paymentOpen}
          onOpenChange={(v) => {
            setPaymentOpen(v)
            if (!v) onRefresh()
          }}
          invoice={paymentInvoice}
          onRefresh={onRefresh}
        />
      )}

      {/* Invoice Detail Panel */}
      {detailOpen && detailInvoice && (
        <InvoiceDetailPanel
          open={detailOpen}
          onOpenChange={(v) => {
            setDetailOpen(v)
            if (!v) onRefresh()
          }}
          invoice={detailInvoice}
          studioName={studioName}
          studioGstin={studioGstin}
          studioBankDetails={studioBankDetails}
          onEdit={(inv) => {
            setDetailOpen(false)
            setEditorInvoice(inv)
            setEditorOpen(true)
          }}
          onRecordPayment={(inv) => {
            setDetailOpen(false)
            setPaymentInvoice(inv)
            setPaymentOpen(true)
          }}
          onRefresh={onRefresh}
        />
      )}

      {/* Send confirm dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(v) => !v && setSendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send invoice{" "}
            <span className="font-medium text-foreground">{sendDialog?.invoice_number}</span> to the
            client via email and WhatsApp.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)}>Cancel</Button>
            <Button
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(v) => !v && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete invoice{" "}
            <span className="font-medium text-foreground">{deleteDialog?.invoice_number}</span>? This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
