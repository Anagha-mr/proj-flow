"use client"

import { useState, useEffect, useCallback } from "react"
import { Lock } from "lucide-react"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import {
  getInvoices,
  getExpenses,
  getProjectFinanceSummary,
  markOverdue,
  type Invoice,
  type ExpenseEntry,
  type ProjectFinanceSummary,
} from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"
import { FinanceSummary } from "./finance-summary"
import { InvoicesSection } from "./invoices-section"
import { RunningCostTracker } from "./running-cost-tracker"
import { ExpenseLog } from "./expense-log"

export interface FinanceTabProps {
  projectId: string
  studioId: string
  userRole: string
  currentUserId: string
  studioStateCode: string
  clientStateCode: string
  studioName: string
  studioGstin: string | null
  studioBankDetails: Record<string, string> | null
  clientId: string
}

export function FinanceTab({
  projectId,
  studioId,
  userRole,
  currentUserId,
  studioStateCode,
  clientStateCode,
  studioName,
  studioGstin,
  studioBankDetails,
  clientId,
}: FinanceTabProps) {
  const { toast } = useToast()
  const canView = hasPermission(userRole as StudioRole, "view_financials")

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [summary, setSummary] = useState<ProjectFinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, exp, sum] = await Promise.all([
        getInvoices(projectId),
        getExpenses(projectId),
        getProjectFinanceSummary(projectId),
      ])
      setInvoices(inv)
      setExpenses(exp)
      setSummary(sum)
    } catch {
      toast({ title: "Failed to load financial data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    if (!canView) return
    load()
    // Fire-and-forget: mark overdue invoices
    markOverdue(projectId).catch(() => {})
  }, [load, canView, projectId])

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Lock className="w-10 h-10 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">Financial Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">
            Financial details are restricted to senior designers and above.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left column — 60% */}
      <div className="flex flex-col gap-6 lg:w-[60%]">
        <FinanceSummary summary={summary} loading={loading} projectId={projectId} />
        <InvoicesSection
          projectId={projectId}
          invoices={invoices}
          loading={loading}
          studioStateCode={studioStateCode}
          clientStateCode={clientStateCode}
          studioName={studioName}
          studioGstin={studioGstin}
          studioBankDetails={studioBankDetails}
          clientId={clientId}
          onRefresh={load}
        />
      </div>

      {/* Right column — 40% */}
      <div className="flex flex-col gap-6 lg:w-[40%]">
        <RunningCostTracker
          projectId={projectId}
          summary={summary}
          loading={loading}
          onRefresh={load}
        />
        <ExpenseLog
          expenses={expenses}
          loading={loading}
          projectId={projectId}
          onRefresh={load}
        />
      </div>
    </div>
  )
}
