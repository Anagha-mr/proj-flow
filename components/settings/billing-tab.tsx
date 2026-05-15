"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { PermissionGate } from "@/components/PermissionGate"
import { useToast } from "@/hooks/use-toast"

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "₹4,999/mo",
    features: [
      "Up to 5 active projects",
      "Up to 3 team members",
      "10 GB file storage",
      "500 WhatsApp messages/month",
      "Basic procurement & finance",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₹9,999/mo",
    features: [
      "Up to 15 active projects",
      "Up to 15 team members",
      "50 GB file storage",
      "2,000 WhatsApp messages/month",
      "RFI tracker + Snag list",
      "Time tracking + profitability",
      "Specification builder",
    ],
  },
  {
    id: "scale" as const,
    name: "Scale",
    price: "₹18,999/mo",
    features: [
      "Unlimited projects",
      "Unlimited team members",
      "200 GB file storage",
      "Unlimited WhatsApp messages",
      "All Pro features",
      "Studio management (HR + payroll)",
      "Advanced reporting + CA export",
    ],
  },
]

interface BillingTabProps {
  currentPlan: "starter" | "pro" | "scale"
  studioId: string
}

function BillingTabInner({ currentPlan, studioId }: BillingTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: "starter" | "pro" | "scale") {
    if (planId === currentPlan) return
    setLoading(planId)
    try {
      // Load Razorpay script dynamically to avoid SSR issues
      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as Record<string, unknown>).Razorpay) { resolve(); return }
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.onload = () => resolve()
        script.onerror = () => reject(new Error("Failed to load Razorpay"))
        document.body.appendChild(script)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        name: "ProjectFlow",
        description: `${PLANS.find((p) => p.id === planId)?.name} Plan`,
        notes: { plan_tier: planId, studio_id: studioId },
        handler: () => {
          toast({ title: "Upgrade successful!", description: "Your plan has been updated." })
          window.location.reload()
        },
      }) as { open: () => void }
      rzp.open()
    } catch (err) {
      toast({ title: "Payment failed", description: String(err), variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((plan) => {
        const isCurrent = plan.id === currentPlan
        return (
          <div
            key={plan.id}
            className={`rounded-xl p-5 flex flex-col gap-4 border-2 transition-colors ${isCurrent ? "border-[#e94560] bg-[#e94560]/5" : "border-gray-100 bg-white"}`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                {isCurrent && (
                  <span className="text-xs bg-[#e94560] text-white px-2 py-0.5 rounded-full font-medium">
                    Current Plan
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-[#1a1a2e]">{plan.price}</p>
            </div>

            <ul className="flex flex-col gap-2 flex-1">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {feat}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={isCurrent || loading === plan.id}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${isCurrent
                ? "bg-gray-100 text-gray-400 cursor-default"
                : "bg-[#e94560] text-white hover:bg-[#d63850] disabled:opacity-50"}`}
            >
              {isCurrent ? "Current Plan" : loading === plan.id ? "Loading…" : "Upgrade →"}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function BillingTab(props: BillingTabProps) {
  return (
    <PermissionGate action="manage_billing">
      <BillingTabInner {...props} />
    </PermissionGate>
  )
}
