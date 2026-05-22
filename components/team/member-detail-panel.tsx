"use client"

import { useState, useRef, useTransition } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
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
import { format, parseISO } from "date-fns"
import { Camera } from "lucide-react"
import {
  updateTeamMember,
  uploadAvatar,
  getLeaveBalances,
  getLeaveRequests,
  reviewLeaveRequest,
  type TeamMember,
  type LeaveBalance,
  type LeaveRequest,
} from "@/app/actions/team"

function getInitials(member: TeamMember): string {
  if (member.full_name) {
    const parts = member.full_name.trim().split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return member.email[0].toUpperCase()
}

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

interface Props {
  member: TeamMember
  currentUserRole: string
  currentUserId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (member: TeamMember) => void
}

export function MemberDetailPanel({ member, currentUserRole, currentUserId, open, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: member.full_name ?? "",
    designation: member.designation ?? "",
    phone: member.phone ?? "",
    date_of_birth: member.date_of_birth ?? "",
    date_of_joining: member.date_of_joining ?? "",
    employment_type: member.employment_type ?? "full_time",
    department: member.department ?? "",
    role: member.role,
    hourly_rate: member.hourly_rate?.toString() ?? "",
  })

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveLoaded, setLeaveLoaded] = useState(false)

  const handleLeaveTabOpen = () => {
    if (leaveLoaded) return
    startTransition(async () => {
      try {
        const [balances, requests] = await Promise.all([
          getLeaveBalances(new Date().getFullYear()),
          getLeaveRequests({ userId: member.id }),
        ])
        setLeaveBalances(balances)
        setLeaveRequests(requests)
        setLeaveLoaded(true)
      } catch {
        toast({ title: "Failed to load leave data", variant: "destructive" })
      }
    })
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        const updated = await updateTeamMember(member.id, {
          full_name: form.full_name || null,
          designation: form.designation || null,
          phone: form.phone || null,
          date_of_birth: form.date_of_birth || null,
          date_of_joining: form.date_of_joining || null,
          employment_type: form.employment_type as TeamMember['employment_type'],
          department: form.department || null,
          ...(currentUserRole === "owner" ? {
            role: form.role as TeamMember['role'],
            hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
          } : {}),
        })
        onUpdated(updated)
        toast({ title: "Changes saved" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    startTransition(async () => {
      try {
        const url = await uploadAvatar(member.id, file)
        onUpdated({ ...member, avatar_url: url })
        toast({ title: "Avatar updated" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleToggleActive = async () => {
    startTransition(async () => {
      try {
        const updated = await updateTeamMember(member.id, { is_active: !member.is_active })
        onUpdated(updated)
        toast({ title: member.is_active ? "Member deactivated" : "Member reactivated" })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const handleReview = (requestId: string, decision: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewLeaveRequest(requestId, decision)
        const updated = await getLeaveRequests({ userId: member.id })
        setLeaveRequests(updated)
        toast({ title: `Leave ${decision}` })
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" })
      }
    })
  }

  const memberBalance = leaveBalances.find(b => b.user_id === member.id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{member.full_name ?? member.email}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="leave" className="flex-1" onClick={handleLeaveTabOpen}>Leave</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
                <div className="w-20 h-20 rounded-full overflow-hidden bg-primary text-white flex items-center justify-center text-2xl font-bold">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(member)
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Designation</Label>
                <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date of Joining</Label>
                <Input type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Employment Type</Label>
                <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v as TeamMember['employment_type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(currentUserRole === "owner" || currentUserRole === "senior_designer") && (
                <div className="space-y-1">
                  <Label>Hourly Rate (₹)</Label>
                  <Input
                    type="number"
                    value={form.hourly_rate}
                    onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                    disabled={currentUserRole !== "owner"}
                  />
                </div>
              )}
              {currentUserRole === "owner" && (
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as TeamMember['role'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="senior_designer">Senior Designer</SelectItem>
                      <SelectItem value="designer">Designer</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={isPending} className="w-full">
              {isPending ? "Saving…" : "Save Changes"}
            </Button>

            {currentUserRole === "owner" && member.id !== currentUserId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={member.is_active ? "destructive" : "outline"} className="w-full" disabled={isPending}>
                    {member.is_active ? "Deactivate Member" : "Reactivate Member"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {member.is_active ? "Deactivate" : "Reactivate"} {member.full_name ?? member.email}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {member.is_active
                        ? "This member will lose access to the studio. You can reactivate them later."
                        : "This member will regain access to the studio."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleActive}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </TabsContent>

          {/* Leave Tab */}
          <TabsContent value="leave" className="mt-4 space-y-4">
            {!leaveLoaded && isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <>
                {memberBalance && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Leave Balance ({new Date().getFullYear()})</p>
                    {[
                      { label: "Annual", used: memberBalance.annual_used, total: memberBalance.annual_total },
                      { label: "Sick", used: memberBalance.sick_used, total: memberBalance.sick_total },
                      { label: "Casual", used: memberBalance.casual_used, total: memberBalance.casual_total },
                    ].map(({ label, used, total }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{label}</span>
                          <span>{used}/{total} days</span>
                        </div>
                        <Progress
                          value={total > 0 ? Math.min((used / total) * 100, 100) : 0}
                          className={`h-2 ${progressColor(used, total)}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Leave Requests</p>
                  {leaveRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leave requests.</p>
                  ) : (
                    leaveRequests.map(req => (
                      <div key={req.id} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_TYPE_BADGE[req.leave_type] ?? ""}`}>
                            {req.leave_type.charAt(0).toUpperCase() + req.leave_type.slice(1)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_STATUS_BADGE[req.status] ?? ""}`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(req.start_date), 'dd MMM yyyy')} –{" "}
                          {format(parseISO(req.end_date), 'dd MMM yyyy')} · {req.days_count} day{req.days_count !== 1 ? "s" : ""}
                        </p>
                        {req.reason && <p className="text-xs">{req.reason}</p>}
                        {req.status === "pending" && (currentUserRole === "owner" || currentUserRole === "senior_designer") && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleReview(req.id, "approved")} disabled={isPending}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReview(req.id, "rejected")} disabled={isPending}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
