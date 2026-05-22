"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO, differenceInCalendarDays, eachDayOfInterval, isWeekend } from "date-fns"
import { Plus } from "lucide-react"
import {
  getLeaveRequests,
  getLeaveBalances,
  createLeaveRequest,
  reviewLeaveRequest,
  type TeamMember,
  type LeaveRequest,
  type LeaveBalance,
} from "@/app/actions/team"

const LEAVE_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
}

const LEAVE_TYPE_BADGE: Record<string, string> = {
  annual: "bg-blue-100 text-blue-700",
  sick: "bg-rose-100 text-rose-700",
  casual: "bg-violet-100 text-violet-700",
  unpaid: "bg-gray-100 text-gray-700",
}

function progressColor(used: number, total: number): string {
  if (total === 0) return ""
  const pct = (used / total) * 100
  if (pct >= 100) return "[&>div]:bg-red-500"
  if (pct >= 75) return "[&>div]:bg-amber-500"
  return "[&>div]:bg-green-500"
}

function countWeekdays(start: string, end: string): number {
  if (!start || !end) return 0
  try {
    const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
    return days.filter(d => !isWeekend(d)).length
  } catch {
    return 0
  }
}

function getInitials(member: TeamMember): string {
  if (member.full_name) {
    const parts = member.full_name.trim().split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return member.email[0].toUpperCase()
}

interface Props {
  members: TeamMember[]
  currentUserRole: string
  currentUserId: string
}

export function LeaveTab({ members, currentUserRole, currentUserId }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [requestOpen, setRequestOpen] = useState(false)

  const currentYear = new Date().getFullYear()
  const [yearFilter, setYearFilter] = useState(String(currentYear))
  const [statusFilter, setStatusFilter] = useState("all")
  const [memberFilter, setMemberFilter] = useState("all")

  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadData = () => {
    startTransition(async () => {
      try {
        const [reqs, bals] = await Promise.all([
          getLeaveRequests({ year: Number(yearFilter) }),
          getLeaveBalances(Number(yearFilter)),
        ])
        setRequests(reqs)
        setBalances(bals)
        setLoaded(true)
      } catch {
        toast({ title: "Failed to load leave data", variant: "destructive" })
      }
    })
  }

  useEffect(() => { loadData() }, [yearFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (memberFilter !== "all" && r.user_id !== memberFilter) return false
      return true
    })
  }, [requests, statusFilter, memberFilter])

  const handleReview = (requestId: string, decision: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewLeaveRequest(requestId, decision)
        const updated = await getLeaveRequests({ year: Number(yearFilter) })
        setRequests(updated)
        toast({ title: `Leave ${decision}` })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const activeMembers = members.filter(m => m.is_active)
  const memberMap = new Map(members.map(m => [m.id, m]))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold">Leave Management</h2>
        <Button size="sm" onClick={() => setRequestOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Request Leave
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Requests" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Requests list */}
      <div className="space-y-2">
        {!loaded && isPending ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No leave requests found.</p>
        ) : (
          filtered.map(req => {
            const m = memberMap.get(req.user_id)
            return (
              <div key={req.id} className="border rounded-lg p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 bg-primary text-white flex items-center justify-center text-xs font-semibold overflow-hidden">
                  {m?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : m ? getInitials(m) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                    <span className="text-sm font-medium">{m?.full_name ?? m?.email ?? "Unknown"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_TYPE_BADGE[req.leave_type] ?? ""}`}>
                      {req.leave_type.charAt(0).toUpperCase() + req.leave_type.slice(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">{req.days_count} day{req.days_count !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(req.start_date), 'dd MMM yyyy')}
                    {req.start_date !== req.end_date && ` – ${format(parseISO(req.end_date), 'dd MMM yyyy')}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_STATUS_BADGE[req.status] ?? ""}`}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                  {req.status === "pending" && (currentUserRole === "owner" || currentUserRole === "senior_designer") && (
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleReview(req.id, "approved")} disabled={isPending}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleReview(req.id, "rejected")} disabled={isPending}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Leave Balances table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Leave Balances ({yearFilter})</h3>
        {!loaded && isPending ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full mb-1" />)
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-center">Annual</TableHead>
                  <TableHead className="text-center">Sick</TableHead>
                  <TableHead className="text-center">Casual</TableHead>
                  <TableHead className="text-center">Days Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">No active members</TableCell></TableRow>
                ) : activeMembers.map(m => {
                  const bal = balances.find(b => b.user_id === m.id)
                  const totalUsed = (bal?.annual_used ?? 0) + (bal?.sick_used ?? 0) + (bal?.casual_used ?? 0)
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.full_name ?? m.email}</TableCell>
                      <TableCell className="text-center text-sm">{bal?.annual_used ?? 0}/{bal?.annual_total ?? 12}</TableCell>
                      <TableCell className="text-center text-sm">{bal?.sick_used ?? 0}/{bal?.sick_total ?? 6}</TableCell>
                      <TableCell className="text-center text-sm">{bal?.casual_used ?? 0}/{bal?.casual_total ?? 6}</TableCell>
                      <TableCell className="text-center text-sm">{totalUsed}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LeaveRequestSheet
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onCreated={() => { setRequestOpen(false); loadData() }}
      />
    </div>
  )
}

interface LeaveRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function LeaveRequestSheet({ open, onOpenChange, onCreated }: LeaveRequestSheetProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    leaveType: "annual" as LeaveRequest['leave_type'],
    startDate: "",
    endDate: "",
    reason: "",
  })

  const daysCount = useMemo(
    () => countWeekdays(form.startDate, form.endDate),
    [form.startDate, form.endDate]
  )

  const today = format(new Date(), 'yyyy-MM-dd')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.startDate || !form.endDate) {
      toast({ title: "Please select start and end dates", variant: "destructive" })
      return
    }
    if (form.startDate < today) {
      toast({ title: "Start date cannot be in the past", variant: "destructive" })
      return
    }
    if (daysCount <= 0) {
      toast({ title: "Leave must include at least one weekday", variant: "destructive" })
      return
    }
    startTransition(async () => {
      try {
        await createLeaveRequest({
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          daysCount,
          reason: form.reason || undefined,
        })
        toast({ title: "Leave request submitted" })
        setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" })
        onCreated()
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Request Leave</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Leave Type</Label>
            <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v as LeaveRequest['leave_type'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" min={today} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" min={form.startDate || today} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          {daysCount > 0 && (
            <p className="text-sm text-muted-foreground">{daysCount} working day{daysCount !== 1 ? "s" : ""}</p>
          )}
          <div className="space-y-1">
            <Label>Reason <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Submitting…" : "Submit Request"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
