"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Pencil, CheckSquare, Wallet, CreditCard, Calendar, ImageIcon, Plus, Trash2, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import { TasksTab } from "@/components/projects/tasks/tasks-tab"
import { DocumentsTab } from "@/components/projects/documents/documents-tab"
import { ProcurementTab } from "@/components/projects/procurement/procurement-tab"
import { FinanceTab } from "@/components/projects/finance/finance-tab"
import { SiteTab } from "@/components/projects/site/site-tab"
import { MeetingsTab } from "@/components/projects/meetings/meetings-tab"
import { RfiTab } from "@/components/projects/rfis/rfi-tab"
import { SnagTab } from "@/components/projects/snags/snag-tab"
import { TimeTab } from "@/components/projects/time/time-tab"
import { SpecTab } from "@/components/projects/spec/spec-tab"
import { StagePaymentsSection } from "@/components/projects/contractors/stage-payments-section"
import { OrdersTab } from "@/components/projects/orders/orders-tab"
import { PortfolioTab } from "@/components/projects/portfolio/portfolio-tab"
import { MoodboardTab } from "@/components/projects/moodboard/moodboard-tab"
import type { SiteUpdate } from "@/app/actions/site"
import type { Meeting } from "@/app/actions/meetings"
import type { RFI } from "@/app/actions/rfis"
import type { SnagItem } from "@/app/actions/snags"
import type { Contractor } from "@/app/actions/contractors"
import type { TimeEntry } from "@/app/actions/time-tracking"
import type { StagePayment } from "@/app/actions/stage-payments"
import type { SpecItem } from "@/app/actions/spec"
import type { OrderTrackingRow, OrderSummary } from "@/app/actions/orders"
import type { Vendor } from "@/app/actions/vendors"
import type { QuoteRequest } from "@/app/actions/quotes"
import type { PortfolioGalleryItem } from "@/app/actions/portfolio"
import type { Moodboard } from "@/app/actions/moodboards"
import { formatDistanceToNow, differenceInDays, format } from "date-fns"
import { updateProject, updateProjectContractValue, addProjectMember, removeProjectMember } from "@/app/actions/projects"
import { getProjectFinanceSummary } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"

type TaskCounts = { total: number; todo: number; in_progress: number; done: number }
type UpcomingTask = { id: string; title: string; status: string; priority: string; phase_tag: string | null; due_date: string | null }

type Project = {
  id: string
  name: string
  type: string
  type_custom: string | null
  status: string
  cover_image_url: string | null
  scope_description: string | null
  scope_items: unknown
  phases: unknown
  pinterest_url: string | null
  address_line1: string | null
  address_line2: string | null
  address_line3: string | null
  postcode: string | null
  updated_at: string
  contract_value?: number | null
  client: { id: string; name: string; email: string | null; phone_primary: string | null; whatsapp_number: string | null } | null
  members: Array<{
    id: string
    user_id: string
    project_role: string
    user: { id: string; name: string; profile_photo_url: string | null; role: string } | null
  }>
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  residential: { label: "Residential", className: "bg-indigo-100 text-indigo-700" },
  commercial:  { label: "Commercial",  className: "bg-purple-100 text-purple-700" },
  hospitality: { label: "Hospitality", className: "bg-pink-100 text-pink-700" },
  retail:      { label: "Retail",      className: "bg-orange-100 text-orange-700" },
  other:       { label: "Other",       className: "bg-gray-100 text-gray-600" },
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  className: "bg-gray-100 text-gray-500" },
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
  urgent: "bg-red-200 text-red-800",
}

const PROJECT_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial",  label: "Commercial" },
  { value: "hospitality", label: "Hospitality" },
  { value: "retail",      label: "Retail" },
  { value: "other",       label: "Other" },
]

const PROJECT_ROLES = [
  { value: "project_lead",     label: "Project Lead" },
  { value: "senior_designer",  label: "Senior Designer" },
  { value: "designer",         label: "Designer" },
  { value: "intern",           label: "Intern" },
  { value: "site_coordinator", label: "Site Coordinator" },
]

const PHASE_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#e94560"]

type Phase = { id: string; name: string; start_date: string; end_date: string; status: string; color: string }
type ScopeItem = { id: string; text: string }

function uid() { return Math.random().toString(36).slice(2) }

function getProjectDates(phases: unknown) {
  if (!Array.isArray(phases) || phases.length === 0) return { start: null, end: null }
  const typed = phases as Array<{ start_date?: string; end_date?: string }>
  const starts = typed.filter((p) => p.start_date).map((p) => p.start_date!)
  const ends = typed.filter((p) => p.end_date).map((p) => p.end_date!)
  if (!starts.length || !ends.length) return { start: null, end: null }
  return {
    start: starts.sort()[0],
    end: ends.sort().at(-1)!,
  }
}

type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }

export function ProjectDetailClient({
  project,
  taskCounts,
  upcomingTasks,
  userRole,
  currentUserId,
  currentUserName,
  studioId,
  studioUsers,
  studioStateCode,
  clientStateCode,
  studioName,
  studioGstin,
  studioBankDetails,
  initialSiteUpdates,
  initialMeetings,
  initialRfis,
  initialSnags,
  projectContractors,
  projectDocuments,
  initialTimeEntries,
  initialStagePayments,
  initialSpecItems,
  currentUserHourlyRate,
  initialOrderTracking,
  initialOrderSummary,
  vendors,
  initialQuoteRequests,
  initialGalleryItems,
  initialMoodboards,
  canvaConnected,
}: {
  project: Project
  taskCounts: TaskCounts
  upcomingTasks: UpcomingTask[]
  userRole: string
  currentUserId: string
  currentUserName: string
  studioId: string
  studioUsers: StudioUser[]
  studioStateCode: string
  clientStateCode: string
  studioName: string
  studioGstin: string | null
  studioBankDetails: Record<string, string> | null
  initialSiteUpdates: SiteUpdate[]
  initialMeetings: Meeting[]
  initialRfis: RFI[]
  initialSnags: SnagItem[]
  projectContractors: Contractor[]
  projectDocuments: Array<{ id: string; name: string }>
  initialTimeEntries: TimeEntry[]
  initialStagePayments: StagePayment[]
  initialSpecItems: SpecItem[]
  currentUserHourlyRate: number | null
  initialOrderTracking: OrderTrackingRow[]
  initialOrderSummary: OrderSummary
  vendors: Vendor[]
  initialQuoteRequests: QuoteRequest[]
  initialGalleryItems: PortfolioGalleryItem[]
  initialMoodboards: Moodboard[]
  canvaConnected: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [localProject, setLocalProject] = useState(project)
  const [saving, setSaving] = useState(false)
  const [financeSummary, setFinanceSummary] = useState<{
    total_invoiced: number; total_cost: number; contract_value: number | null
  } | null>(null)
  const [contractValue, setContractValue] = useState<number | null>(project.contract_value ?? null as number | null)
  const [cvInput, setCvInput] = useState("")
  const [cvPopoverOpen, setCvPopoverOpen] = useState(false)
  const [savingCV, setSavingCV] = useState(false)

  const typeMeta = TYPE_BADGE[localProject.type] ?? TYPE_BADGE.other
  const statusMeta = STATUS_BADGE[localProject.status] ?? STATUS_BADGE.active
  const canEditFinance = userRole === "owner" || userRole === "senior_designer"

  // Load finance summary for Overview tab stat cards
  useEffect(() => {
    if (!canEditFinance) return
    getProjectFinanceSummary(project.id)
      .then((s) => setFinanceSummary({ total_invoiced: s.total_invoiced, total_cost: s.total_cost, contract_value: s.contract_value }))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  async function handleSaveContractValue() {
    const val = parseFloat(cvInput)
    if (isNaN(val) || val < 0) {
      toast({ title: "Enter a valid contract value", variant: "destructive" })
      return
    }
    setSavingCV(true)
    try {
      await updateProjectContractValue(localProject.id, val)
      setContractValue(val)
      setCvPopoverOpen(false)
      setCvInput("")
      toast({ title: "Contract value saved." })
    } catch {
      toast({ title: "Failed to save contract value", variant: "destructive" })
    } finally {
      setSavingCV(false)
    }
  }
  const { start, end } = getProjectDates(localProject.phases)
  const daysRemaining = end ? differenceInDays(new Date(end), new Date()) : null

  async function saveEdit(patch: Partial<Parameters<typeof updateProject>[1]>) {
    setSaving(true)
    try {
      const updated = await updateProject(localProject.id, patch)
      setLocalProject((prev) => ({ ...prev, ...updated }))
      toast({ title: "Saved" })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(userId: string, projectRole: string) {
    try {
      await addProjectMember(localProject.id, userId, projectRole)
      const user = studioUsers.find((u) => u.id === userId) ?? null
      setLocalProject((prev) => ({
        ...prev,
        members: [
          ...prev.members.filter((m) => m.user_id !== userId),
          {
            id: `${prev.id}-${userId}`,
            user_id: userId,
            project_role: projectRole,
            user: user ? { id: user.id, name: user.name, profile_photo_url: user.profile_photo_url, role: user.role } : null,
          },
        ],
      }))
      toast({ title: "Team member added" })
    } catch {
      toast({ title: "Failed to add team member", variant: "destructive" })
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeProjectMember(localProject.id, userId)
      setLocalProject((prev) => ({ ...prev, members: prev.members.filter((m) => m.user_id !== userId) }))
      toast({ title: "Team member removed" })
    } catch {
      toast({ title: "Failed to remove team member", variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-0 -m-6">
      {/* Cover banner */}
      <div className="relative h-32 overflow-hidden">
        {localProject.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={localProject.cover_image_url}
            alt={localProject.name}
            className="w-full h-full object-cover blur-sm scale-110 brightness-50"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#1a1a2e] to-[#2d2d4e]" />
        )}
        <div className="absolute inset-0 flex items-end pb-4 px-6">
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="absolute top-3 left-4 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white leading-tight">{localProject.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {localProject.client && (
                <span className="text-white/70 text-sm">{localProject.client.name}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeMeta.className}`}>
                {typeMeta.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-6 pt-4">
        <Tabs defaultValue="overview">
          <TabsList className="overflow-x-auto flex w-full justify-start h-auto bg-transparent border-b rounded-none p-0 gap-0 mb-6">
            {[
              { label: "Overview",     value: "overview" },
              { label: "Moodboard",    value: "moodboard" },
              { label: "Tasks",        value: "tasks" },
              { label: "Documents",    value: "documents" },
              { label: "Procurement",  value: "procurement" },
              { label: "Finance",      value: "finance" },
              { label: "Site",         value: "site" },
              { label: "Meetings",     value: "meetings" },
              { label: "RFI",          value: "rfi" },
              { label: "Snag List",    value: "snag-list" },
              { label: "Contractors",  value: "contractors" },
              { label: "Time",         value: "time" },
              { label: "Spec",         value: "spec" },
              { label: "Orders",       value: "orders" },
              { label: "Portfolio",    value: "portfolio" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#e94560] data-[state=active]:bg-transparent data-[state=active]:text-[#e94560] px-4 pb-2 shrink-0"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview">
            <div className="flex flex-col gap-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tasks card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{taskCounts.total}</p>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-green-600">{taskCounts.done} done</span>
                      <span className="text-blue-600">{taskCounts.in_progress} in progress</span>
                      <span className="text-[#e94560]">{taskCounts.todo} to do</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Budget card */}
                <Card className={!canEditFinance ? "opacity-50" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Budget
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {canEditFinance ? (
                      <>
                        <p className="text-2xl font-bold">
                          {financeSummary
                            ? financeSummary.total_invoiced.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
                            : "₹ —"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {contractValue != null
                            ? `of ${contractValue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} contract`
                            : (
                              <Popover open={cvPopoverOpen} onOpenChange={setCvPopoverOpen}>
                                <PopoverTrigger asChild>
                                  <button className="text-xs text-[#e94560] hover:underline">
                                    Set contract value
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3" align="start">
                                  <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium">Contract Value ₹</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={cvInput}
                                      onChange={(e) => setCvInput(e.target.value)}
                                      placeholder="e.g. 500000"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" className="flex-1" onClick={handleSaveContractValue} disabled={savingCV}>
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setCvPopoverOpen(false)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </CardContent>
                </Card>

                {/* Expenses card */}
                <Card className={!canEditFinance ? "opacity-50" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {canEditFinance ? (
                      <>
                        <p className="text-2xl font-bold">
                          {financeSummary
                            ? financeSummary.total_cost.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
                            : "₹ —"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total project cost</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {start && end ? (
                      <>
                        <p className="text-sm font-semibold">
                          {format(new Date(start), "dd MMM yy")} → {format(new Date(end), "dd MMM yy")}
                        </p>
                        <p className={`text-xs mt-1 ${daysRemaining !== null && daysRemaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {daysRemaining === null
                            ? "—"
                            : daysRemaining < 0
                            ? `${Math.abs(daysRemaining)} days overdue`
                            : `${daysRemaining} days remaining`}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No timeline set</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Widgets row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Upcoming tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Upcoming Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No upcoming tasks — add tasks in the Tasks tab.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {upcomingTasks.map((task) => (
                          <div key={task.id} className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              {task.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                                </p>
                              )}
                            </div>
                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority] ?? "bg-gray-100 text-gray-600"}`}>
                              {task.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Team widget */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Team</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      {localProject.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                              {(member.user?.name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{member.user?.name ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{member.project_role.replace("_", " ")}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{member.user?.role ?? ""}</span>
                        </div>
                      ))}
                      {localProject.members.length === 0 && (
                        <p className="text-sm text-muted-foreground">No team members assigned.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── Moodboard Tab ── */}
          <TabsContent value="moodboard">
            <MoodboardTab
              projectId={localProject.id}
              studioId={studioId}
              canvaConnected={canvaConnected}
              initialMoodboards={initialMoodboards}
            />
          </TabsContent>

          {/* ── Tasks Tab ── */}
          <TabsContent value="tasks">
            <TasksTab
              projectId={localProject.id}
              projectPhases={
                (Array.isArray(localProject.phases)
                  ? (localProject.phases as Array<{ id: string; name: string; color: string }>)
                  : []
                ).filter((p) => p.id && p.name)
              }
              userRole={userRole}
              currentUserId={currentUserId}
              studioUsers={studioUsers}
            />
          </TabsContent>

          {/* ── Documents Tab ── */}
          <TabsContent value="documents">
            <DocumentsTab
              projectId={localProject.id}
              studioId={studioId}
              projectMembers={localProject.members
                .filter((m) => m.user !== null)
                .map((m) => ({
                  id: m.user!.id,
                  name: m.user!.name,
                  role: m.user!.role,
                }))}
              userRole={userRole}
              currentUserId={currentUserId}
            />
          </TabsContent>

          {/* ── Procurement Tab ── */}
          <TabsContent value="procurement">
            <ProcurementTab
              projectId={localProject.id}
              studioId={studioId}
              userRole={userRole}
              currentUserId={currentUserId}
              initialQuoteRequests={initialQuoteRequests}
              vendors={vendors}
            />
          </TabsContent>

          {/* ── Finance Tab ── */}
          <TabsContent value="finance">
            <FinanceTab
              projectId={localProject.id}
              studioId={studioId}
              userRole={userRole}
              currentUserId={currentUserId}
              studioStateCode={studioStateCode}
              clientStateCode={clientStateCode}
              studioName={studioName}
              studioGstin={studioGstin}
              studioBankDetails={studioBankDetails}
              clientId={localProject.client?.id ?? ""}
            />
          </TabsContent>

          {/* ── Site Tab ── */}
          <TabsContent value="site">
            <SiteTab
              project={{ id: localProject.id, studio_id: studioId }}
              initialUpdates={initialSiteUpdates}
              currentUser={{ id: currentUserId, role: userRole }}
            />
          </TabsContent>

          {/* ── Meetings Tab ── */}
          <TabsContent value="meetings">
            <MeetingsTab
              project={{ id: localProject.id, studio_id: studioId, name: localProject.name }}
              initialMeetings={initialMeetings}
              currentUser={{ id: currentUserId, name: currentUserName, role: userRole }}
              studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
            />
          </TabsContent>

          {/* ── RFI Tab ── */}
          <TabsContent value="rfi">
            <RfiTab
              project={{ id: localProject.id, studio_id: studioId, name: localProject.name }}
              initialRfis={initialRfis}
              currentUser={{ id: currentUserId, name: currentUserName, role: userRole }}
              projectDocuments={projectDocuments}
              projectContractors={projectContractors}
              projectMembers={localProject.members
                .filter((m) => m.user !== null)
                .map((m) => ({
                  id: m.user!.id,
                  name: m.user!.name,
                }))}
            />
          </TabsContent>

          {/* ── Snag List Tab ── */}
          <TabsContent value="snag-list">
            <SnagTab
              project={{ id: localProject.id, studio_id: studioId, name: localProject.name }}
              initialSnags={initialSnags}
              currentUser={{ id: currentUserId, name: currentUserName, role: userRole }}
              projectContractors={projectContractors}
              studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
            />
          </TabsContent>

          {/* ── Contractors Tab ── */}
          <TabsContent value="contractors">
            <div className="flex flex-col gap-6">
              {/* Assigned contractors list */}
              {projectContractors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contractors assigned to this project yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectContractors.map((c) => (
                    <div key={c.id} className="bg-white border rounded-lg p-4">
                      <p className="font-semibold">{c.company_name}</p>
                      <p className="text-sm text-muted-foreground">{c.contact_name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground mt-1">{c.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
              {/* Stage Payments */}
              <StagePaymentsSection
                project={{ id: localProject.id }}
                initialPayments={initialStagePayments}
                projectContractors={projectContractors}
                currentUser={{ id: currentUserId, role: userRole }}
              />
            </div>
          </TabsContent>

          {/* ── Time Tab ── */}
          <TabsContent value="time">
            <TimeTab
              project={{
                id: localProject.id,
                studio_id: studioId,
                name: localProject.name,
                phases: (Array.isArray(localProject.phases)
                  ? (localProject.phases as Array<{ name: string }>)
                  : []
                ),
              }}
              initialEntries={initialTimeEntries}
              currentUser={{ id: currentUserId, name: currentUserName, role: userRole, hourly_rate: currentUserHourlyRate }}
              studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
            />
          </TabsContent>

          {/* ── Spec Tab ── */}
          <TabsContent value="spec">
            <SpecTab
              project={{ id: localProject.id, studio_id: studioId, name: localProject.name }}
              initialItems={initialSpecItems}
              currentUser={{ id: currentUserId, role: userRole }}
            />
          </TabsContent>

          {/* ── Orders Tab ── */}
          <TabsContent value="orders">
            <OrdersTab
              orderTracking={initialOrderTracking}
              orderSummary={initialOrderSummary}
              vendors={vendors}
              projectId={localProject.id}
            />
          </TabsContent>

          {/* ── Portfolio Tab ── */}
          <TabsContent value="portfolio">
            <PortfolioTab
              project={{
                id: localProject.id,
                name: localProject.name,
                type: localProject.type,
                status: localProject.status,
                cover_image_url: localProject.cover_image_url,
                portfolio_summary: (localProject as Record<string, unknown>).portfolio_summary as string | null ?? null,
                portfolio_key_decisions: (localProject as Record<string, unknown>).portfolio_key_decisions as string | null ?? null,
                portfolio_location_city: (localProject as Record<string, unknown>).portfolio_location_city as string | null ?? null,
                portfolio_year_completed: (localProject as Record<string, unknown>).portfolio_year_completed as number | null ?? null,
                portfolio_published: (localProject as Record<string, unknown>).portfolio_published as boolean ?? false,
                client: localProject.client,
                members: localProject.members.map((m) => ({
                  user_id: m.user_id,
                  project_role: m.project_role,
                  user: m.user ? { id: m.user.id, name: m.user.name } : null,
                })),
              }}
              galleryItems={initialGalleryItems}
              studioId={studioId}
              userRole={userRole}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit side panel */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Project</SheetTitle>
          </SheetHeader>
          <EditProjectForm
            project={localProject}
            onSave={saveEdit}
            saving={saving}
            studioId={studioId}
            studioUsers={studioUsers}
            currentUserId={currentUserId}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EditProjectForm({
  project,
  onSave,
  saving,
  studioId,
  studioUsers,
  currentUserId,
  onAddMember,
  onRemoveMember,
}: {
  project: Project
  onSave: (patch: Partial<Parameters<typeof updateProject>[1]>) => void
  saving: boolean
  studioId: string
  studioUsers: StudioUser[]
  currentUserId: string
  onAddMember: (userId: string, projectRole: string) => void
  onRemoveMember: (userId: string) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(project.name)
  const [scopeDesc, setScopeDesc] = useState(project.scope_description ?? "")
  const [status, setStatus] = useState(project.status)
  const [pinterestUrl, setPinterestUrl] = useState(project.pinterest_url ?? "")
  const [type, setType] = useState(project.type)
  const [typeCustom, setTypeCustom] = useState(project.type_custom ?? "")
  const [addressLine1, setAddressLine1] = useState(project.address_line1 ?? "")
  const [addressLine2, setAddressLine2] = useState(project.address_line2 ?? "")
  const [addressLine3, setAddressLine3] = useState(project.address_line3 ?? "")
  const [postcode, setPostcode] = useState(project.postcode ?? "")
  const [phases, setPhases] = useState<Phase[]>(
    Array.isArray(project.phases) ? (project.phases as Phase[]) : []
  )
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>(
    Array.isArray(project.scope_items) ? (project.scope_items as ScopeItem[]) : []
  )
  const [coverPreview, setCoverPreview] = useState(project.cover_image_url)
  const [uploadingCover, setUploadingCover] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Cover image ──────────────────────────────────────────────
  async function handleCoverFile(file: File) {
    if (!file.type.match(/image\/(jpeg|png|webp)/)) return
    const reader = new FileReader()
    reader.onload = (e) => setCoverPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setUploadingCover(true)
    try {
      const supabase = createClient()
      // Fixed path (no timestamp) so re-uploads overwrite the previous cover
      // instead of leaving orphaned files in Storage.
      const path = `${studioId}/${project.id}/cover`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("projectflow-files")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from("projectflow-files")
        .getPublicUrl(uploadData.path)
      // Cache-bust so the new image shows immediately even though the path is unchanged
      onSave({ cover_image_url: `${urlData.publicUrl}?t=${Date.now()}` })
    } catch {
      toast({ title: "Failed to upload cover image", variant: "destructive" })
      setCoverPreview(project.cover_image_url)
    } finally {
      setUploadingCover(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleCoverFile(file)
  }

  // ── Phases ───────────────────────────────────────────────────
  function updatePhase(id: string, field: keyof Phase, value: string) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  function commitPhases(next: Phase[]) {
    onSave({ phases: next })
  }

  function addPhase() {
    const next = [
      ...phases,
      { id: uid(), name: "New Phase", start_date: "", end_date: "", status: "pending", color: PHASE_COLORS[phases.length % PHASE_COLORS.length] },
    ]
    setPhases(next)
    commitPhases(next)
  }

  function removePhase(id: string) {
    const next = phases.filter((p) => p.id !== id)
    setPhases(next)
    commitPhases(next)
  }

  // ── Scope items ──────────────────────────────────────────────
  function updateScopeItem(id: string, text: string) {
    setScopeItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)))
  }

  function commitScopeItems(next: ScopeItem[]) {
    onSave({ scope_items: next })
  }

  function addScopeItem() {
    const next = [...scopeItems, { id: uid(), text: "" }]
    setScopeItems(next)
  }

  function removeScopeItem(id: string) {
    const next = scopeItems.filter((i) => i.id !== id)
    setScopeItems(next)
    commitScopeItems(next)
  }

  // ── Team assignment ──────────────────────────────────────────
  const assignedIds = new Set(project.members.map((m) => m.user_id))
  const unassignedUsers = studioUsers.filter((u) => !assignedIds.has(u.id))

  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Cover image */}
      <div>
        <label className="text-sm font-medium mb-2 block">Cover Image</label>
        <div
          className="border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-[#e94560] transition-colors relative"
          style={{ aspectRatio: "16/9", maxHeight: 180 }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="w-8 h-8" />
              <span className="text-sm">Drag & drop or click to upload</span>
              <span className="text-xs">JPG, PNG, WEBP</span>
            </div>
          )}
          {uploadingCover && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
              Uploading…
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f) }}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Project Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== project.name && onSave({ name })}
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      {/* Project type */}
      <div>
        <label className="text-sm font-medium mb-2 block">Project Type</label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setType(t.value)
                onSave({ type: t.value, type_custom: t.value === "other" ? typeCustom : null })
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                type === t.value
                  ? "border-[#e94560] bg-[#e94560]/10 text-[#e94560]"
                  : "border-input text-muted-foreground hover:border-[#e94560]/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {type === "other" && (
          <div className="mt-2">
            <Input
              value={typeCustom}
              onChange={(e) => setTypeCustom(e.target.value)}
              onBlur={() => typeCustom !== (project.type_custom ?? "") && onSave({ type_custom: typeCustom })}
              placeholder="Describe the project type"
              className="focus-visible:ring-[#e94560]"
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Status</label>
        <Select
          value={status}
          onValueChange={(v) => { setStatus(v); onSave({ status: v }) }}
        >
          <SelectTrigger className="focus:ring-[#e94560]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Address */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Address</label>
        <div className="flex flex-col gap-2">
          <Input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            onBlur={() => addressLine1 !== (project.address_line1 ?? "") && onSave({ address_line1: addressLine1 || null })}
            placeholder="Address Line 1"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            onBlur={() => addressLine2 !== (project.address_line2 ?? "") && onSave({ address_line2: addressLine2 || null })}
            placeholder="Address Line 2"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={addressLine3}
            onChange={(e) => setAddressLine3(e.target.value)}
            onBlur={() => addressLine3 !== (project.address_line3 ?? "") && onSave({ address_line3: addressLine3 || null })}
            placeholder="Address Line 3"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onBlur={() => postcode !== (project.postcode ?? "") && onSave({ postcode: postcode || null })}
            placeholder="Postcode"
            className="focus-visible:ring-[#e94560]"
          />
        </div>
      </div>

      {/* Phases */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Phases</label>
          <button
            onClick={addPhase}
            className="flex items-center gap-1 text-xs text-[#e94560] font-medium hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add phase
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {phases.map((phase) => (
            <div key={phase.id} className="border rounded-lg p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                <Input
                  value={phase.name}
                  onChange={(e) => updatePhase(phase.id, "name", e.target.value)}
                  onBlur={() => commitPhases(phases)}
                  placeholder="Phase name"
                  className="flex-1 h-8 text-sm focus-visible:ring-[#e94560]"
                />
                <button
                  onClick={() => removePhase(phase.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={phase.start_date}
                    onChange={(e) => updatePhase(phase.id, "start_date", e.target.value)}
                    onBlur={() => commitPhases(phases)}
                    className="h-8 text-sm focus-visible:ring-[#e94560]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={phase.end_date}
                    onChange={(e) => updatePhase(phase.id, "end_date", e.target.value)}
                    onBlur={() => commitPhases(phases)}
                    className="h-8 text-sm focus-visible:ring-[#e94560]"
                  />
                </div>
              </div>
            </div>
          ))}
          {phases.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No phases yet. Click &ldquo;+ Add phase&rdquo; to define the timeline.</p>
          )}
        </div>
      </div>

      {/* Team assignment */}
      <div>
        <label className="text-sm font-medium mb-2 block">Team</label>
        <div className="flex flex-col gap-2">
          {project.members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 border rounded-lg p-2.5">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                  {(m.user?.name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.user?.name ?? "Unknown"}
                  {m.user_id === currentUserId && <span className="text-xs text-muted-foreground"> (you)</span>}
                </p>
              </div>
              <Select
                value={m.project_role}
                onValueChange={(v) => onAddMember(m.user_id, v)}
              >
                <SelectTrigger className="h-8 w-40 text-xs focus:ring-[#e94560]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => onRemoveMember(m.user_id)}
                disabled={m.user_id === currentUserId}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title={m.user_id === currentUserId ? "You cannot remove yourself" : "Remove from project"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {project.members.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No team members assigned.</p>
          )}
        </div>

        {unassignedUsers.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1.5">Add to project</p>
            <div className="flex flex-wrap gap-2">
              {unassignedUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onAddMember(u.id, "designer")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium hover:border-[#e94560] hover:text-[#e94560] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Scope Description</label>
        <Textarea
          value={scopeDesc}
          onChange={(e) => setScopeDesc(e.target.value)}
          onBlur={() => scopeDesc !== (project.scope_description ?? "") && onSave({ scope_description: scopeDesc })}
          rows={4}
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      {/* Scope items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Scope Items</label>
          <button
            onClick={addScopeItem}
            className="flex items-center gap-1 text-xs text-[#e94560] font-medium hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add item
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {scopeItems.map((item) => (
            <div key={item.id} className="flex gap-2 items-center">
              <Input
                value={item.text}
                onChange={(e) => updateScopeItem(item.id, e.target.value)}
                onBlur={() => commitScopeItems(scopeItems)}
                placeholder="e.g. Living room interior design"
                className="flex-1 focus-visible:ring-[#e94560]"
              />
              <button
                onClick={() => removeScopeItem(item.id)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {scopeItems.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No scope items yet.</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Pinterest / Reference URL</label>
        <Input
          value={pinterestUrl}
          onChange={(e) => setPinterestUrl(e.target.value)}
          onBlur={() => pinterestUrl !== (project.pinterest_url ?? "") && onSave({ pinterest_url: pinterestUrl })}
          placeholder="https://pinterest.com/…"
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  )
}
