"use client"

import { useState, useEffect } from "react"
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
import { ArrowLeft, Pencil, CheckSquare, Wallet, CreditCard, Calendar } from "lucide-react"
import { TasksTab } from "@/components/projects/tasks/tasks-tab"
import { DocumentsTab } from "@/components/projects/documents/documents-tab"
import { ProcurementTab } from "@/components/projects/procurement/procurement-tab"
import { FinanceTab } from "@/components/projects/finance/finance-tab"
import { SiteTab } from "@/components/projects/site/site-tab"
import { MeetingsTab } from "@/components/projects/meetings/meetings-tab"
import { RfiTab } from "@/components/projects/rfis/rfi-tab"
import { SnagTab } from "@/components/projects/snags/snag-tab"
import type { SiteUpdate } from "@/app/actions/site"
import type { Meeting } from "@/app/actions/meetings"
import type { RFI } from "@/app/actions/rfis"
import type { SnagItem } from "@/app/actions/snags"
import type { Contractor } from "@/app/actions/contractors"
import { formatDistanceToNow, differenceInDays, format } from "date-fns"
import { updateProject } from "@/app/actions/projects"
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
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [localProject, setLocalProject] = useState(project)
  const [saving, setSaving] = useState(false)
  const [financeSummary, setFinanceSummary] = useState<{
    total_invoiced: number; total_cost: number; contract_value: number | null
  } | null>(null)

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
  const { start, end } = getProjectDates(localProject.phases)
  const daysRemaining = end ? differenceInDays(new Date(end), new Date()) : null

  async function saveEdit(field: string, value: string) {
    setSaving(true)
    try {
      const updated = await updateProject(localProject.id, { [field]: value })
      setLocalProject((prev) => ({ ...prev, ...updated }))
      toast({ title: "Saved" })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
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
              { label: "Overview",    value: "overview" },
              { label: "Tasks",       value: "tasks" },
              { label: "Documents",   value: "documents" },
              { label: "Procurement", value: "procurement" },
              { label: "Finance",     value: "finance" },
              { label: "Site",        value: "site" },
              { label: "Meetings",    value: "meetings" },
              { label: "RFI",         value: "rfi" },
              { label: "Snag List",   value: "snag-list" },
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
                          {financeSummary?.contract_value
                            ? `of ${financeSummary.contract_value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} contract`
                            : "Total invoiced"}
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
        </Tabs>
      </div>

      {/* Edit side panel */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Project</SheetTitle>
          </SheetHeader>
          <EditProjectForm project={localProject} onSave={saveEdit} saving={saving} />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EditProjectForm({
  project,
  onSave,
  saving,
}: {
  project: Project
  onSave: (field: string, value: string) => void
  saving: boolean
}) {
  const [name, setName] = useState(project.name)
  const [scopeDesc, setScopeDesc] = useState(project.scope_description ?? "")
  const [status, setStatus] = useState(project.status)
  const [pinterestUrl, setPinterestUrl] = useState(project.pinterest_url ?? "")

  return (
    <div className="flex flex-col gap-5 mt-6">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Project Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== project.name && onSave("name", name)}
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Status</label>
        <Select
          value={status}
          onValueChange={(v) => { setStatus(v); onSave("status", v) }}
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

      <div>
        <label className="text-sm font-medium mb-1.5 block">Scope Description</label>
        <Textarea
          value={scopeDesc}
          onChange={(e) => setScopeDesc(e.target.value)}
          onBlur={() => scopeDesc !== (project.scope_description ?? "") && onSave("scope_description", scopeDesc)}
          rows={4}
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Pinterest / Reference URL</label>
        <Input
          value={pinterestUrl}
          onChange={(e) => setPinterestUrl(e.target.value)}
          onBlur={() => pinterestUrl !== (project.pinterest_url ?? "") && onSave("pinterest_url", pinterestUrl)}
          placeholder="https://pinterest.com/…"
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  )
}
