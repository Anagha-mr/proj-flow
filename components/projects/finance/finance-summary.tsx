"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import type { ProjectFinanceSummary } from "@/app/actions/finance"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

interface FinanceSummaryProps {
  summary: ProjectFinanceSummary | null
  loading: boolean
  projectId: string
}

export function FinanceSummary({ summary, loading, projectId }: FinanceSummaryProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!summary) return null

  const hasContractValue = summary.contract_value != null && summary.contract_value > 0
  const costPercent = hasContractValue
    ? Math.min(Math.round((summary.total_cost / summary.contract_value!) * 100), 100)
    : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Total Invoiced */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(summary.total_invoiced)}</p>
            {summary.overdue_count > 0 && (
              <p className="text-xs text-red-600 mt-1">{summary.overdue_count} overdue</p>
            )}
          </CardContent>
        </Card>

        {/* Collected */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatINR(summary.total_collected)}</p>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card className={summary.total_outstanding > 0 ? "bg-red-50 border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs font-medium ${summary.total_outstanding > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.total_outstanding > 0 ? "text-red-700" : ""}`}>
              {formatINR(summary.total_outstanding)}
            </p>
          </CardContent>
        </Card>

        {/* Project Cost */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Project Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {hasContractValue ? (
              <>
                <p className="text-2xl font-bold">{formatINR(summary.total_cost)}</p>
                <p className="text-xs text-muted-foreground mt-1">of {formatINR(summary.contract_value!)} estimate</p>
                <Progress
                  value={costPercent}
                  className="mt-2 h-1.5"
                />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">{formatINR(summary.total_cost)}</p>
                <p className="text-xs text-muted-foreground mt-1">No contract value set</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gross Margin */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm text-muted-foreground">Gross Margin:</span>
        <span className={`text-sm font-semibold ${summary.gross_margin >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatINR(summary.gross_margin)}
        </span>
      </div>
    </div>
  )
}
