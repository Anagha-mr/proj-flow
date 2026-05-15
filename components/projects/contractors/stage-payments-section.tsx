"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { releasePayment, confirmPaymentReceived, deleteStagePayment, type StagePayment } from "@/app/actions/stage-payments"
import { AddStagePaymentSheet } from "./add-stage-payment-sheet"
import type { Contractor } from "@/app/actions/contractors"
import { format } from "date-fns"

interface StagePaymentsSectionProps {
  project: { id: string }
  initialPayments: StagePayment[]
  projectContractors: Contractor[]
  currentUser: { id: string; role: string }
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600" },
  released: { label: "Released", className: "bg-amber-100 text-amber-700" },
  received: { label: "Received", className: "bg-green-100 text-green-700" },
}

export function StagePaymentsSection({
  project,
  initialPayments,
  projectContractors,
  currentUser,
}: StagePaymentsSectionProps) {
  const { toast } = useToast()
  const [payments, setPayments] = useState<StagePayment[]>(initialPayments)
  const [showAdd, setShowAdd] = useState(false)

  const role = currentUser.role as StudioRole
  const canManage = hasPermission(role, "manage_stage_payments")

  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)
  const releasedTotal = payments.filter((p) => p.status === "released").reduce((s, p) => s + p.amount, 0)
  const receivedTotal = payments.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0)

  const formatINR = (n: number) =>
    n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

  // Group by contractor
  const byContractor: Record<string, StagePayment[]> = {}
  for (const p of payments) {
    if (!byContractor[p.contractor_id]) byContractor[p.contractor_id] = []
    byContractor[p.contractor_id].push(p)
  }

  async function handleRelease(paymentId: string) {
    try {
      await releasePayment(paymentId)
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId ? { ...p, status: "released", released_at: new Date().toISOString() } : p
        )
      )
      toast({ title: "Payment released. WhatsApp sent to contractor." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleConfirmReceipt(paymentId: string) {
    try {
      await confirmPaymentReceived(paymentId)
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId ? { ...p, status: "received", received_at: new Date().toISOString() } : p
        )
      )
      toast({ title: "Receipt confirmed." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleDelete(paymentId: string) {
    try {
      await deleteStagePayment(paymentId)
      setPayments((prev) => prev.filter((p) => p.id !== paymentId))
      toast({ title: "Milestone deleted." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Stage Payments</h3>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Milestone
          </Button>
        )}
      </div>

      {/* Summary pills */}
      {payments.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Pending: {formatINR(pendingTotal)}</span>
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700">Released: {formatINR(releasedTotal)}</span>
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">Received: {formatINR(receivedTotal)}</span>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="border border-dashed rounded-xl px-6 py-8 text-center text-sm text-muted-foreground">
          No payment milestones yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byContractor).map(([contractorId, cPayments]) => {
            const contractor = cPayments[0]?.contractor
            const name = contractor ? contractor.company_name : contractorId
            return (
              <div key={contractorId}>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">{name}</p>
                <div className="flex flex-col gap-2">
                  {cPayments.map((payment) => {
                    const badge = STATUS_BADGE[payment.status] ?? STATUS_BADGE.pending
                    return (
                      <div key={payment.id} className="bg-white border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{payment.milestone_name}</p>
                          {payment.milestone_description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{payment.milestone_description}</p>
                          )}
                          {payment.expected_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expected: {format(new Date(payment.expected_date), "d MMM yyyy")}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-lg font-bold">{formatINR(payment.amount)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {payment.status === "pending" && canManage && (
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => handleRelease(payment.id)}
                            >
                              Release
                            </Button>
                          )}
                          {payment.status === "released" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleConfirmReceipt(payment.id)}
                            >
                              Confirm Receipt
                            </Button>
                          )}
                          {payment.status === "pending" && canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(payment.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddStagePaymentSheet
        open={showAdd}
        onOpenChange={setShowAdd}
        projectId={project.id}
        projectContractors={projectContractors}
        onAdded={(p) => setPayments((prev) => [...prev, p])}
      />
    </div>
  )
}
