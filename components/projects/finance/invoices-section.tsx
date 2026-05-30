"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreHorizontal, FileText, Link2, PauseCircle, PlayCircle, Loader2 } from "lucide-react"
import {
  createInvoice,
  deleteInvoice,
  type Invoice,
} from "@/app/actions/finance"
import {
  sendInvoiceToClient,
  pauseInvoiceReminders,
  resumeInvoiceReminders,
  type InvoiceWithPayments,
} from "@/app/actions/payments"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { InvoiceEditorSheet } from "./invoice-editor-sheet"
import { RecordPaymentSheet } from "./record-payment-sheet"
import { InvoiceDetailPanel } from "./invoice-detail-panel"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })
}

// Covers both Sprint 6 ('partial') and Sprint 17 ('partially_paid') DB values
const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:         { label: "Draft",         className: "bg-slate-100 text-slate-700" },
  sent:          { label: "Sent",           className: "bg-blue-100 text-blue-800" },
  partial:       { label: "Partial",        className: "bg-amber-100 text-amber-800" },
  partially_paid:{ label: "Partial",        className: "bg-amber-100 text-amber-800" },
  paid:          { label: "Paid",           className: "bg-green-100 text-green-800" },
  overdue:       { label: "Overdue",        className: "bg-red-100 text-red-800" },
  cancelled:     { label: "Cancelled",      className: "bg-slate-100 text-slate-500" },
}

type AnyInvoice = Invoice | InvoiceWithPayments

function getAmountOutstanding(inv: AnyInvoice): number {
  if ("amount_outstanding" in inv) return (inv as InvoiceWithPayments).amount_outstanding
  return (inv as Invoice).amount_due ?? 0
}

function getPaymentLinkUrl(inv: AnyInvoice): string | null {
  if ("razorpay_payment_link_url" in inv)
    return (inv as InvoiceWithPayments).razorpay_payment_link_url
  return null
}

function isRemindersPaused(inv: AnyInvoice): boolean {
  if ("reminders_paused" in inv) return !!(inv as InvoiceWithPayments).reminders_paused
  return false
}

interface InvoicesSectionProps {
  projectId: string
  invoices: AnyInvoice[]
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
  const [paymentInvoice, setPaymentInvoice] = useState<AnyInvoice | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Send invoice dialog
  const [sendDialog, setSendDialog] = useState<AnyInvoice | null>(null)
  const [sending, setSending] = useState(false)
  // Optimistic status map: invoiceId -> status
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({})

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<AnyInvoice | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Pause/resume loading
  const [pausingId, setPausingId] = useState<string | null>(null)

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
    // Optimistic update
    setOptimisticStatus((prev) => ({ ...prev, [sendDialog.id]: "sent" }))
    setSendDialog(null)
    try {
      await sendInvoiceToClient(sendDialog.id)
      const clientName = (sendDialog as AnyInvoice & { client?: { name: string } }).client?.name ?? "client"
      toast({ title: `Invoice sent to ${clientName}` })
      onRefresh()
    } catch (err) {
      // Roll back optimistic update
      setOptimisticStatus((prev) => {
        const updated = { ...prev }
        delete updated[sendDialog.id]
        return updated
      })
      toast({
        title: err instanceof Error ? err.message : "Failed to send invoice",
        variant: "destructive",
      })
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
      toast({
        title: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handlePauseReminders(inv: AnyInvoice) {
    const paused = isRemindersPaused(inv)
    setPausingId(inv.id)
    try {
      if (paused) {
        await resumeInvoiceReminders(inv.id)
        toast({ title: "Reminders resumed" })
      } else {
        await pauseInvoiceReminders(inv.id)
        toast({ title: "Reminders paused" })
      }
      onRefresh()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update reminders",
        variant: "destructive",
      })
    } finally {
      setPausingId(null)
    }
  }

  async function copyPaymentLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Payment link copied to clipboard", duration: 2000 })
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" })
    }
  }

  function openEditor(inv: Invoice) {
    setEditorInvoice(inv)
    setEditorOpen(true)
  }

  function openPayment(inv: AnyInvoice) {
    setPaymentInvoice(inv)
    setPaymentOpen(true)
  }

  function openDetail(inv: AnyInvoice) {
    // Detail panel still uses the old Invoice type — cast best-effort
    setDetailInvoice(inv as Invoice)
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
            <p className="text-xs text-muted-foreground mt-1">
              Create your first invoice to get started
            </p>
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
            const displayStatus = optimisticStatus[inv.id] ?? inv.status
            const statusMeta = STATUS_META[displayStatus] ?? STATUS_META.draft
            const isOverdue = displayStatus === "overdue"
            const outstanding = getAmountOutstanding(inv)
            const paymentLinkUrl = getPaymentLinkUrl(inv)
            const remindersPaused = isRemindersPaused(inv)
            const canPauseReminders =
              displayStatus === "sent" ||
              displayStatus === "partial" ||
              displayStatus === "partially_paid" ||
              displayStatus === "overdue"

            return (
              <div
                key={inv.id}
                className="border rounded-lg p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => openDetail(inv)}
              >
                {/* Top row: invoice number + status + amount + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {inv.invoice_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}
                      >
                        {isOverdue && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                        {statusMeta.label}
                      </span>
                      {remindersPaused && (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          Reminders paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {(inv as AnyInvoice & { client?: { name: string } }).client
                        ?.name && (
                        <span>
                          {(inv as AnyInvoice & { client?: { name: string } }).client!.name}
                        </span>
                      )}
                      <span>
                        Issued {format(new Date(inv.issue_date), "dd MMM yyyy")}
                      </span>
                      {inv.due_date && (
                        <span>
                          Due {format(new Date(inv.due_date), "dd MMM yyyy")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right mr-1">
                      <p className="text-sm font-bold">{formatINR(inv.total)}</p>
                      {displayStatus !== "draft" && (
                        <p
                          className={`text-xs ${
                            outstanding > 0 && isOverdue
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {outstanding > 0
                            ? `${formatINR(outstanding)} outstanding`
                            : "Fully paid"}
                        </p>
                      )}
                    </div>

                    {/* Pay link copy */}
                    {paymentLinkUrl && (
                      <button
                        title="Copy payment link"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyPaymentLink(paymentLinkUrl)
                        }}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {displayStatus === "draft" && (
                          <DropdownMenuItem onClick={() => openEditor(inv as Invoice)}>
                            Edit
                          </DropdownMenuItem>
                        )}
                        {(displayStatus === "draft" || displayStatus === "sent") && (
                          <DropdownMenuItem onClick={() => setSendDialog(inv)}>
                            {displayStatus === "sent" ? "Re-send Invoice" : "Send Invoice"}
                          </DropdownMenuItem>
                        )}
                        {canPauseReminders && (
                          <DropdownMenuItem
                            onClick={() => handlePauseReminders(inv)}
                            disabled={pausingId === inv.id}
                          >
                            {pausingId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            ) : remindersPaused ? (
                              <PlayCircle className="w-3.5 h-3.5 mr-2" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5 mr-2" />
                            )}
                            {remindersPaused ? "Resume Reminders" : "Pause Reminders"}
                          </DropdownMenuItem>
                        )}
                        {(displayStatus === "sent" ||
                          displayStatus === "partial" ||
                          displayStatus === "partially_paid" ||
                          displayStatus === "overdue") && (
                          <DropdownMenuItem onClick={() => openPayment(inv)}>
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(
                              `/api/finance/invoice-pdf?invoiceId=${inv.id}`,
                              "_blank"
                            )
                          }
                        >
                          Download PDF
                        </DropdownMenuItem>
                        {displayStatus === "draft" && (
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

                {/* Bottom row: inline action buttons for active invoices */}
                {canPauseReminders && (
                  <div
                    className="flex items-center gap-2 mt-3 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2 text-muted-foreground"
                      onClick={() => handlePauseReminders(inv)}
                      disabled={pausingId === inv.id}
                    >
                      {pausingId === inv.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : remindersPaused ? (
                        <PlayCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <PauseCircle className="w-3 h-3 mr-1" />
                      )}
                      {remindersPaused ? "Resume Reminders" : "Pause Reminders"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2 text-muted-foreground"
                      onClick={() => openPayment(inv)}
                    >
                      Record Payment
                    </Button>
                  </div>
                )}
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
          invoice={paymentInvoice as Invoice}
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

      {/* Send Invoice AlertDialog */}
      <AlertDialog open={!!sendDialog} onOpenChange={(v) => !v && setSendDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send Invoice to{" "}
              {(sendDialog as AnyInvoice & { client?: { name: string } })?.client?.name ?? "client"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Invoice{" "}
                  <span className="font-medium text-foreground">
                    {sendDialog?.invoice_number}
                  </span>{" "}
                  for{" "}
                  <span className="font-medium text-foreground">
                    {sendDialog ? formatINR(sendDialog.total) : ""}
                  </span>{" "}
                  will be sent via WhatsApp with a Razorpay payment link.
                </p>
                {sendDialog?.due_date && (
                  <p>
                    Due:{" "}
                    <span className="font-medium text-foreground">
                      {format(new Date(sendDialog.due_date), "dd MMM yyyy")}
                    </span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={sending}
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Invoice"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteDialog}
        onOpenChange={(v) => !v && setDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete invoice{" "}
            <span className="font-medium text-foreground">
              {deleteDialog?.invoice_number}
            </span>
            ? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
