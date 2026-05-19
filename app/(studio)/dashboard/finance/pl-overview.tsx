"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { RevenueChart } from "./revenue-chart"
import { StudioExpenseLog } from "./studio-expense-log"
import { AddExpenseSheet } from "./add-expense-sheet"
import type { StudioPLSummary, StudioExpense } from "@/app/actions/studio-finance"

const INR = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const CATEGORY_COLORS: Record<string, string> = {
  rent: "#64748b",
  salaries: "#3b82f6",
  software: "#8b5cf6",
  marketing: "#ec4899",
  utilities: "#eab308",
  equipment: "#f97316",
  professional_fees: "#14b8a6",
  travel: "#22c55e",
  other: "#9ca3af",
}

interface Props {
  summary: StudioPLSummary
  studioExpenses: StudioExpense[]
  userRole: string
  isPending: boolean
  onExpensesChange: (expenses: StudioExpense[]) => void
}

export function PLOverview({ summary, studioExpenses, userRole, isPending, onExpensesChange }: Props) {
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)

  const canManageExpenses = userRole === "owner" || userRole === "senior_designer"

  const statCards = [
    {
      label: "Revenue",
      value: summary.total_revenue,
      className: "bg-[#1a1a2e] text-white",
      valueClass: "text-white",
      subClass: "text-white/60",
    },
    {
      label: "Project Costs",
      value: summary.total_project_costs,
      className: "",
      valueClass: "",
      subClass: "text-muted-foreground",
    },
    {
      label: "Studio Expenses",
      value: summary.total_studio_expenses,
      className: "",
      valueClass: "",
      subClass: "text-muted-foreground",
    },
    {
      label: "Gross Profit",
      value: summary.gross_profit,
      className: summary.gross_profit >= 0 ? "bg-green-50" : "bg-red-50",
      valueClass: summary.gross_profit >= 0 ? "text-green-700" : "text-red-700",
      subClass: summary.gross_profit >= 0 ? "text-green-600" : "text-red-600",
      sub: summary.gross_margin_percent != null
        ? `${summary.gross_margin_percent.toFixed(1)}% gross margin`
        : undefined,
    },
    {
      label: "Net Profit",
      value: summary.net_profit,
      className: summary.net_profit >= 0 ? "bg-green-50" : "bg-red-50",
      valueClass: summary.net_profit >= 0 ? "text-green-700" : "text-red-700",
      subClass: summary.net_profit >= 0 ? "text-green-600" : "text-red-600",
      sub: summary.net_margin_percent != null
        ? `${summary.net_margin_percent.toFixed(1)}% net margin`
        : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {isPending
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : statCards.map((card) => (
              <Card key={card.label} className={card.className}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className={`text-xs font-medium ${card.subClass}`}>
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className={`text-2xl font-bold ${card.valueClass}`}>{INR(card.value)}</p>
                  {card.sub && (
                    <p className={`text-xs mt-0.5 ${card.subClass}`}>{card.sub}</p>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Revenue vs Costs chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Revenue vs Costs</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <RevenueChart data={summary.revenue_by_month} />
          )}
        </CardContent>
      </Card>

      {/* Expense breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-52 w-full rounded-lg" />
            ) : summary.expenses_by_category.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                No studio expenses recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={summary.expenses_by_category}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={100}
                  >
                    {summary.expenses_by_category.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] ?? "#9ca3af"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => INR(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.expenses_by_category.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {summary.expenses_by_category.map((row) => (
                  <div key={row.category} className="flex items-center justify-between gap-2">
                    <CategoryBadge category={row.category} />
                    <span className="text-sm font-medium">{INR(row.amount)}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {row.percent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Studio Expense Log */}
      <StudioExpenseLog
        expenses={studioExpenses}
        userRole={userRole}
        onExpensesChange={onExpensesChange}
        onAddNew={() => setAddExpenseOpen(true)}
      />

      {canManageExpenses && (
        <AddExpenseSheet
          open={addExpenseOpen}
          onOpenChange={setAddExpenseOpen}
          onSaved={(newExp) => onExpensesChange([newExp, ...studioExpenses])}
        />
      )}
    </div>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  const CLASS_MAP: Record<string, string> = {
    rent: "bg-slate-100 text-slate-700",
    salaries: "bg-blue-100 text-blue-800",
    software: "bg-violet-100 text-violet-800",
    marketing: "bg-pink-100 text-pink-800",
    utilities: "bg-yellow-100 text-yellow-800",
    equipment: "bg-orange-100 text-orange-800",
    professional_fees: "bg-teal-100 text-teal-800",
    travel: "bg-green-100 text-green-800",
    other: "bg-gray-100 text-gray-600",
  }
  const LABEL: Record<string, string> = {
    rent: "Rent",
    salaries: "Salaries",
    software: "Software",
    marketing: "Marketing",
    utilities: "Utilities",
    equipment: "Equipment",
    professional_fees: "Professional Fees",
    travel: "Travel",
    other: "Other",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASS_MAP[category] ?? "bg-gray-100 text-gray-600"}`}>
      {LABEL[category] ?? category}
    </span>
  )
}
