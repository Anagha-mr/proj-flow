"use client"

import { useState } from "react"
import { CheckCircle } from "lucide-react"
import { format } from "date-fns"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-slate-100 text-slate-600" },
  released:  { label: "Released",  className: "bg-amber-100 text-amber-700" },
  received:  { label: "Received",  className: "bg-green-100 text-green-700" },
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-700" },
}

interface Payment {
  id: string
  milestone_name: string
  milestone_description: string | null
  amount: number
  status: string
  released_at: string | null
  contractor_confirmed_at: string | null
  project_name: string
}

interface ContractorStagePaymentsProps {
  contractorToken: string
  payments: Payment[]
}

export function ContractorStagePayments({
  contractorToken,
  payments,
}: ContractorStagePaymentsProps) {
  const [confirmedMap, setConfirmedMap] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})

  async function handleConfirm(paymentId: string) {
    setLoadingId(paymentId)
    setErrorMap((prev) => ({ ...prev, [paymentId]: "" }))

    try {
      const res = await fetch("/api/stage-payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_payment_id: paymentId,
          contractor_token: contractorToken,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as Record<string, string>).error ?? "Failed to confirm")
      }

      setConfirmedMap((prev) => ({
        ...prev,
        [paymentId]: new Date().toISOString(),
      }))
    } catch (err) {
      setErrorMap((prev) => ({
        ...prev,
        [paymentId]: err instanceof Error ? err.message : "Failed to confirm",
      }))
    } finally {
      setLoadingId(null)
    }
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No stage payments found for your account.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {payments.map((payment) => {
        const isConfirmed =
          confirmedMap[payment.id] !== undefined ||
          payment.contractor_confirmed_at !== null ||
          payment.status === "confirmed"

        const confirmedAt =
          confirmedMap[payment.id] ??
          payment.contractor_confirmed_at ??
          null

        const isReleased =
          payment.status === "released" && !isConfirmed

        const badge = STATUS_BADGE[isConfirmed ? "confirmed" : payment.status] ?? STATUS_BADGE.pending

        return (
          <div
            key={payment.id}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-gray-900">
                    {payment.milestone_name}
                  </span>
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{payment.project_name}</p>
                {payment.milestone_description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {payment.milestone_description}
                  </p>
                )}
                {payment.released_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Released{" "}
                    {format(new Date(payment.released_at), "dd MMM yyyy")}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-gray-900">
                  {formatINR(payment.amount)}
                </p>
              </div>
            </div>

            {/* Confirm receipt or confirmed state */}
            <div className="mt-4">
              {isConfirmed ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-[#1D9E75]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirmed{" "}
                  {confirmedAt
                    ? format(new Date(confirmedAt), "dd MMM yyyy")
                    : ""}
                </div>
              ) : isReleased ? (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleConfirm(payment.id)}
                    disabled={loadingId === payment.id}
                    className="inline-flex items-center justify-center bg-accent text-white rounded-[6px] px-4 py-2 text-sm font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: "#e94560" }}
                  >
                    {loadingId === payment.id ? "Confirming…" : "Confirm Receipt"}
                  </button>
                  {errorMap[payment.id] && (
                    <p className="text-xs text-red-600">{errorMap[payment.id]}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
