"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  createStudioExpense,
  updateStudioExpense,
  deleteStudioExpense,
  type StudioExpense,
} from "@/app/actions/studio-finance"

type ExpenseCategory = StudioExpense["category"]
type RecurrenceType = StudioExpense["recurrence"]

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "salaries", label: "Salaries" },
  { value: "software", label: "Software" },
  { value: "marketing", label: "Marketing" },
  { value: "utilities", label: "Utilities" },
  { value: "equipment", label: "Equipment" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingExpense?: StudioExpense | null
  onSaved: (expense: StudioExpense) => void
  onDeleted?: (id: string) => void
  userRole?: string
}

export function AddExpenseSheet({
  open,
  onOpenChange,
  editingExpense,
  onSaved,
  onDeleted,
  userRole,
}: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isEdit = !!editingExpense
  const isOwner = userRole === "owner"

  const [category, setCategory] = useState<ExpenseCategory>(editingExpense?.category ?? "other")
  const [description, setDescription] = useState(editingExpense?.description ?? "")
  const [amount, setAmount] = useState(editingExpense?.amount?.toString() ?? "")
  const [expenseDate, setExpenseDate] = useState(
    editingExpense?.expense_date ?? new Date().toISOString().slice(0, 10)
  )
  const [reference, setReference] = useState(editingExpense?.reference ?? "")
  const [isRecurring, setIsRecurring] = useState(editingExpense?.is_recurring ?? false)
  const [recurrence, setRecurrence] = useState<RecurrenceType>(editingExpense?.recurrence ?? null)

  function resetForm() {
    setCategory("other")
    setDescription("")
    setAmount("")
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setReference("")
    setIsRecurring(false)
    setRecurrence(null)
  }

  async function handleSave() {
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" })
      return
    }
    const amtNum = parseFloat(amount)
    if (isNaN(amtNum) || amtNum < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        category,
        description: description.trim(),
        amount: amtNum,
        expense_date: expenseDate,
        reference: reference.trim() || null,
        is_recurring: isRecurring,
        recurrence: isRecurring ? recurrence : null,
      }

      if (isEdit && editingExpense) {
        const updated = await updateStudioExpense(editingExpense.id, payload)
        onSaved(updated)
        toast({ title: "Expense updated." })
      } else {
        const created = await createStudioExpense(payload)
        onSaved(created)
        toast({ title: "Expense recorded." })
        resetForm()
      }

      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingExpense) return
    setSaving(true)
    try {
      await deleteStudioExpense(editingExpense.id)
      onDeleted?.(editingExpense.id)
      toast({ title: "Expense deleted." })
      onOpenChange(false)
      setDeleteOpen(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[440px] sm:w-[440px] flex flex-col">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit Expense" : "Add Studio Expense"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4">
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Office rent for May"
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <Label>Amount ₹ <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <Label>Expense Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            {/* Reference */}
            <div className="flex flex-col gap-1.5">
              <Label>Reference / Invoice No (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-2025-001"
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center justify-between gap-4">
              <Label>Recurring</Label>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
              <div className="flex flex-col gap-1.5">
                <Label>Recurrence</Label>
                <Select
                  value={recurrence ?? ""}
                  onValueChange={(v) => setRecurrence(v as RecurrenceType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cadence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-4 gap-2">
            {isEdit && isOwner && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={saving}
              >
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
