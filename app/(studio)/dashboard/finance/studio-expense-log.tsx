"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Plus, MoreHorizontal } from "lucide-react"
import { AddExpenseSheet } from "./add-expense-sheet"
import { CategoryBadge } from "./pl-overview"
import type { StudioExpense } from "@/app/actions/studio-finance"
import { format } from "date-fns"

const INR = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const RECURRENCE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
}

interface Props {
  expenses: StudioExpense[]
  userRole: string
  onExpensesChange: (expenses: StudioExpense[]) => void
  onAddNew: () => void
}

export function StudioExpenseLog({ expenses, userRole, onExpensesChange, onAddNew }: Props) {
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [editingExpense, setEditingExpense] = useState<StudioExpense | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)

  const canManage = userRole === "owner" || userRole === "senior_designer"
  const isOwner = userRole === "owner"

  const filtered = expenses.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false
    if (fromDate && e.expense_date < fromDate) return false
    if (toDate && e.expense_date > toDate) return false
    return true
  })

  const totalForPeriod = filtered.reduce((s, e) => s + e.amount, 0)

  const uniqueCategories = [...new Set(expenses.map((e) => e.category))]

  function handleEdited(updated: StudioExpense) {
    onExpensesChange(expenses.map((e) => (e.id === updated.id ? updated : e)))
  }

  function handleDeleted(id: string) {
    onExpensesChange(expenses.filter((e) => e.id !== id))
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Studio Expenses</CardTitle>
            <Badge variant="secondary" className="text-xs">{expenses.length}</Badge>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={onAddNew}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Expense
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category pills */}
            <button
              onClick={() => setCategoryFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${categoryFilter === "all" ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "border-border text-muted-foreground hover:border-foreground"}`}
            >
              All
            </button>
            {uniqueCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${categoryFilter === cat ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "border-border text-muted-foreground hover:border-foreground"}`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}

            {/* Date range */}
            <div className="flex items-center gap-1 ml-auto">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 w-32 text-xs"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 w-32 text-xs"
                placeholder="To"
              />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {expenses.length === 0
                ? "No studio expenses logged. Add overhead costs like rent, salaries, and software subscriptions to calculate net profit accurately."
                : "No expenses match the current filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left pb-2 pr-3 font-medium">Date</th>
                    <th className="text-left pb-2 pr-3 font-medium">Category</th>
                    <th className="text-left pb-2 pr-3 font-medium">Description</th>
                    <th className="text-right pb-2 pr-3 font-medium">Amount</th>
                    <th className="text-left pb-2 pr-3 font-medium">Recurring</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => { setEditingExpense(expense); setEditSheetOpen(true) }}
                    >
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(expense.expense_date), "dd MMM yyyy")}
                      </td>
                      <td className="py-2.5 pr-3">
                        <CategoryBadge category={expense.category} />
                      </td>
                      <td className="py-2.5 pr-3 max-w-[200px] truncate">{expense.description}</td>
                      <td className="py-2.5 pr-3 text-right font-medium">{INR(expense.amount)}</td>
                      <td className="py-2.5 pr-3">
                        {expense.is_recurring && expense.recurrence ? (
                          <Badge variant="secondary" className="text-xs">
                            {RECURRENCE_LABEL[expense.recurrence] ?? expense.recurrence}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingExpense(expense); setEditSheetOpen(true) }}>
                                Edit
                              </DropdownMenuItem>
                              {isOwner && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setEditingExpense(expense); setEditSheetOpen(true) }}
                                >
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-end border-t pt-3 text-sm">
              <span className="text-muted-foreground mr-2">Total for period:</span>
              <span className="font-semibold">{INR(totalForPeriod)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit sheet */}
      {canManage && editingExpense && (
        <AddExpenseSheet
          open={editSheetOpen}
          onOpenChange={(o) => { setEditSheetOpen(o); if (!o) setEditingExpense(null) }}
          editingExpense={editingExpense}
          onSaved={handleEdited}
          onDeleted={handleDeleted}
          userRole={userRole}
        />
      )}
    </>
  )
}
