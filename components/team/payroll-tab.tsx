"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2 } from "lucide-react"
import {
  getPayrollSummary,
  upsertPayrollEntry,
  deletePayrollEntry,
  type TeamMember,
  type PayrollEntry,
  type PayrollSummary,
} from "@/app/actions/team"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

interface Props {
  members: TeamMember[]
}

export function PayrollTab({ members }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<PayrollEntry | null>(null)

  const loadSummary = () => {
    startTransition(async () => {
      try {
        const s = await getPayrollSummary(month, year)
        setSummary(s)
        setLoaded(true)
      } catch {
        toast({ title: "Failed to load payroll", variant: "destructive" })
      }
    })
  }

  useEffect(() => { loadSummary() }, [month, year]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (entryId: string) => {
    startTransition(async () => {
      try {
        await deletePayrollEntry(entryId)
        toast({ title: "Entry deleted" })
        loadSummary()
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const years = [year - 2, year - 1, year, year + 1, year + 2]

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditEntry(null); setSheetOpen(true) }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Entry
        </Button>
      </div>

      {/* Summary cards */}
      {!loaded && isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Total Base</p>
            <p className="text-xl font-semibold">{fmt(summary?.total_base ?? 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Deductions</p>
            <p className="text-xl font-semibold">{fmt(summary?.total_deductions ?? 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Net Payroll</p>
            <p className="text-xl font-semibold text-green-700">{fmt(summary?.total_net ?? 0)}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Payroll table */}
      {!loaded && isPending ? (
        <div className="space-y-1">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (summary?.entries.length ?? 0) === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No payroll entries for this period.
          <br />
          <Button size="sm" className="mt-3" onClick={() => { setEditEntry(null); setSheetOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Entry
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Bonuses</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(summary?.entries ?? []).map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-sm">
                    {entry.member?.full_name ?? entry.member?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmt(Number(entry.base_amount))}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(Number(entry.deductions))}</TableCell>
                  <TableCell className="text-right text-sm">{Number(entry.bonuses) > 0 ? fmt(Number(entry.bonuses)) : "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmt(Number(entry.net_amount))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditEntry(entry); setSheetOpen(true) }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete payroll entry?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(entry.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PayrollEntrySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={editEntry}
        members={members.filter(m => m.is_active)}
        periodMonth={month}
        periodYear={year}
        onSaved={() => { setSheetOpen(false); loadSummary() }}
      />
    </div>
  )
}

interface PayrollEntrySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PayrollEntry | null
  members: TeamMember[]
  periodMonth: number
  periodYear: number
  onSaved: () => void
}

function PayrollEntrySheet({ open, onOpenChange, entry, members, periodMonth, periodYear, onSaved }: PayrollEntrySheetProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    userId: entry?.user_id ?? "",
    baseAmount: entry?.base_amount?.toString() ?? "",
    deductions: entry?.deductions?.toString() ?? "0",
    bonuses: entry?.bonuses?.toString() ?? "0",
    notes: entry?.notes ?? "",
  })

  useEffect(() => {
    setForm({
      userId: entry?.user_id ?? "",
      baseAmount: entry?.base_amount?.toString() ?? "",
      deductions: entry?.deductions?.toString() ?? "0",
      bonuses: entry?.bonuses?.toString() ?? "0",
      notes: entry?.notes ?? "",
    })
  }, [entry, open])

  const netPreview = useMemo(() => {
    const base = Number(form.baseAmount) || 0
    const ded = Number(form.deductions) || 0
    const bon = Number(form.bonuses) || 0
    return base - ded + bon
  }, [form.baseAmount, form.deductions, form.bonuses])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.userId) {
      toast({ title: "Please select a team member", variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        await upsertPayrollEntry({
          userId: form.userId,
          periodMonth,
          periodYear,
          baseAmount: Number(form.baseAmount),
          deductions: Number(form.deductions),
          bonuses: Number(form.bonuses),
          notes: form.notes || undefined,
        })
        toast({ title: "Payroll entry saved" })
        onSaved()
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{entry ? "Edit Payroll Entry" : "Add Payroll Entry"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Team Member</Label>
            <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select member…" /></SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Base Amount (₹)</Label>
            <Input
              type="number"
              min={0}
              value={form.baseAmount}
              onChange={e => setForm(f => ({ ...f, baseAmount: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Deductions (₹)</Label>
              <Input type="number" min={0} value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Bonuses (₹)</Label>
              <Input type="number" min={0} value={form.bonuses} onChange={e => setForm(f => ({ ...f, bonuses: e.target.value }))} />
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Net Amount</span>
            <span className="text-sm font-semibold">{netPreview.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</span>
          </div>
          <div className="space-y-1">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save Entry"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
