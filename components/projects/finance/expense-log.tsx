"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MoreHorizontal, Receipt } from "lucide-react"
import { updateExpense, deleteExpense, type ExpenseEntry } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  procurement:    { label: "Procurement",    className: "bg-blue-100 text-blue-700" },
  contractor:     { label: "Contractor",     className: "bg-orange-100 text-orange-700" },
  vendor_payment: { label: "Vendor Payment", className: "bg-purple-100 text-purple-700" },
  consultant_fee: { label: "Consultant Fee", className: "bg-teal-100 text-teal-700" },
  site_expense:   { label: "Site Expense",   className: "bg-amber-100 text-amber-700" },
  other:          { label: "Other",          className: "bg-slate-100 text-slate-600" },
}

const EXPENSE_CATEGORIES: Array<{ value: ExpenseEntry["category"]; label: string }> = [
  { value: "procurement",     label: "Procurement" },
  { value: "contractor",      label: "Contractor" },
  { value: "vendor_payment",  label: "Vendor Payment" },
  { value: "consultant_fee",  label: "Consultant Fee" },
  { value: "site_expense",    label: "Site Expense" },
  { value: "other",           label: "Other" },
]

interface ExpenseLogProps {
  expenses: ExpenseEntry[]
  loading: boolean
  projectId: string
  onRefresh: () => void
}

export function ExpenseLog({ expenses, loading, projectId, onRefresh }: ExpenseLogProps) {
  const { toast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState<ExpenseEntry["category"]>("other")
  const [editDate, setEditDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  function startEdit(expense: ExpenseEntry) {
    setEditingId(expense.id)
    setEditDesc(expense.description)
    setEditAmount(String(expense.amount))
    setEditCategory(expense.category)
    setEditDate(expense.expense_date)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit() {
    if (!editingId) return
    const amt = parseFloat(editAmount)
    if (!editDesc.trim() || isNaN(amt) || amt < 0) {
      toast({ title: "Enter valid description and amount", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await updateExpense(editingId, {
        description: editDesc.trim(),
        amount: amt,
        category: editCategory,
        expense_date: editDate,
      })
      toast({ title: "Expense updated" })
      setEditingId(null)
      onRefresh()
    } catch {
      toast({ title: "Failed to update expense", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteExpense(deleteTarget.id)
      toast({ title: "Expense deleted" })
      setDeleteTarget(null)
      onRefresh()
    } catch {
      toast({ title: "Failed to delete expense", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Expense Log</CardTitle>
            {!loading && (
              <Badge className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5">
                {expenses.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Receipt className="w-6 h-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No expenses logged yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {expenses.map((expense) => {
                const catMeta = CATEGORY_META[expense.category] ?? CATEGORY_META.other
                const isEditing = editingId === expense.id

                if (isEditing) {
                  return (
                    <div key={expense.id} className="border rounded-lg p-3 bg-muted/30 flex flex-col gap-2">
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                        className="h-7 text-xs focus-visible:ring-[#e94560]"
                      />
                      <div className="flex gap-2">
                        <Select
                          value={editCategory}
                          onValueChange={(v) => setEditCategory(v as ExpenseEntry["category"])}
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
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="Amount"
                          className="h-7 text-xs focus-visible:ring-[#e94560] w-24"
                        />
                      </div>
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-7 text-xs focus-visible:ring-[#e94560]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#e94560] hover:bg-[#c73652] text-white flex-1"
                          onClick={handleSaveEdit}
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-2 py-2 border-b last:border-b-0"
                  >
                    <Badge className={`text-xs px-1.5 py-0.5 shrink-0 ${catMeta.className}`}>
                      {catMeta.label}
                    </Badge>
                    <span className="text-xs flex-1 min-w-0 truncate">{expense.description}</span>
                    <span className="text-xs font-medium shrink-0">{formatINR(expense.amount)}</span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {format(new Date(expense.expense_date), "dd MMM")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(expense)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete &ldquo;{deleteTarget?.description}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
