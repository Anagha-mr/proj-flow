"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, X, ExternalLink, AlertTriangle } from "lucide-react"
import { createExpense, type ProjectFinanceSummary, type ExpenseEntry } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

const EXPENSE_CATEGORIES: Array<{ value: ExpenseEntry["category"]; label: string }> = [
  { value: "procurement",     label: "Procurement" },
  { value: "contractor",      label: "Contractor" },
  { value: "vendor_payment",  label: "Vendor Payment" },
  { value: "consultant_fee",  label: "Consultant Fee" },
  { value: "site_expense",    label: "Site Expense" },
  { value: "other",           label: "Other" },
]

interface RunningCostTrackerProps {
  projectId: string
  summary: ProjectFinanceSummary | null
  loading: boolean
  onRefresh: () => void
}

export function RunningCostTracker({
  projectId,
  summary,
  loading,
  onRefresh,
}: RunningCostTrackerProps) {
  const { toast } = useToast()
  const [addingExpense, setAddingExpense] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState("")
  const [expenseCategory, setExpenseCategory] = useState<ExpenseEntry["category"]>("other")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0])
  const [saving, setSaving] = useState(false)

  async function handleSaveExpense() {
    const amt = parseFloat(expenseAmount)
    if (!expenseDesc.trim() || !amt || amt < 0) {
      toast({ title: "Enter a description and valid amount", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await createExpense({
        projectId,
        category: expenseCategory,
        description: expenseDesc.trim(),
        amount: amt,
        expenseDate,
      })
      toast({ title: "Expense added" })
      setExpenseDesc("")
      setExpenseAmount("")
      setExpenseCategory("other")
      setExpenseDate(new Date().toISOString().split("T")[0])
      setAddingExpense(false)
      onRefresh()
    } catch {
      toast({ title: "Failed to add expense", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Running Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) return null

  const hasContractValue = summary.contract_value != null && summary.contract_value > 0
  const isOverBudget = hasContractValue && summary.total_cost > summary.contract_value!
  const costPercent = hasContractValue
    ? Math.round((summary.total_cost / summary.contract_value!) * 100)
    : 0
  const overage = hasContractValue ? summary.total_cost - summary.contract_value! : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Running Costs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Cost rows */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Procurement (Approved)</span>
              <a
                href="#procurement"
                className="text-muted-foreground hover:text-[#e94560] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <span className="font-medium">{formatINR(summary.procurement_cost)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Other Expenses</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatINR(summary.expense_total)}</span>
              <button
                onClick={() => setAddingExpense(true)}
                className="text-muted-foreground hover:text-[#e94560] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="border-t pt-2 flex items-center justify-between font-semibold">
            <span>Total Project Cost</span>
            <span>{formatINR(summary.total_cost)}</span>
          </div>
        </div>

        {/* Contract value progress */}
        {hasContractValue ? (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{costPercent}% of {formatINR(summary.contract_value!)} estimate used</span>
            </div>
            <Progress
              value={Math.min(costPercent, 100)}
              className={`h-2 ${isOverBudget ? "[&>div]:bg-red-500" : ""}`}
            />
            {isOverBudget && (
              <div className="flex items-center gap-1 mt-2 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Over budget by {formatINR(overage)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Set a contract value to track budget usage.</p>
        )}

        {/* Inline expense form */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: addingExpense ? "300px" : "0px" }}
        >
          <div className="border rounded-lg p-3 bg-muted/30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Add Expense</p>
              <button
                onClick={() => setAddingExpense(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <Input
              placeholder="Description"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              className="h-7 text-xs focus-visible:ring-[#e94560]"
            />
            <div className="flex gap-2">
              <Select
                value={expenseCategory}
                onValueChange={(v) => setExpenseCategory(v as ExpenseEntry["category"])}
              >
                <SelectTrigger className="h-7 text-xs focus:ring-[#e94560] flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                placeholder="Amount ₹"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-7 text-xs focus-visible:ring-[#e94560] w-28"
              />
            </div>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="h-7 text-xs focus-visible:ring-[#e94560]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-[#e94560] hover:bg-[#c73652] text-white flex-1"
                onClick={handleSaveExpense}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setAddingExpense(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
