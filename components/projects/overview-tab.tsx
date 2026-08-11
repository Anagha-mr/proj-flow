"use client"

/**
 * Sprint 15 — Overview Tab
 * Extracted from project-detail-client.tsx.
 * Rendered by app/(studio)/dashboard/projects/[id]/overview/page.tsx
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowLeft, Pencil, CheckSquare, Wallet, CreditCard, Calendar } from "lucide-react"
import { formatDistanceToNow, differenceInDays, format } from "date-fns"
import { updateProject, updateProjectContractValue, updateProjectNarrativeSettings } from "@/app/actions/projects"
import { getProjectFinanceSummary } from "@/app/actions/finance"
import { useToast } from "@/hooks/use-toast"

type TaskCounts = { total: number; todo: number; in_progress: number; done: number }
type UpcomingTask = {
  id: string; title: string; status: string; priority: string
  phase_tag: string | null; due_date: string | null
}
type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }

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
  narrative_frequency?: string | null
  narrative_language?: string | null
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
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-gray-100 text-gray-600",
  urgent: "bg-red-200 text-red-800",
}

function getProjectDates(phases: unknown) {
  if (!Array.isArray(phases) || phases.length === 0) return { start: null, end: null }
  const typed = phases as Array<{ start_date?: string; end_date?: string }>
  const starts = typed.filter((p) => p.start_date).map((p) => p.start_date!)
  const ends   = typed.filter((p) => p.end_date).map((p) => p.end_date!)
  if (!starts.length || !ends.length) return { start: null, end: null }
  return { start: starts.sort()[0], end: ends.sort().at(-1)! }
}

interface OverviewTabProps {
  project: Project
  taskCounts: TaskCounts
  upcomingTasks: UpcomingTask[]
  userRole: string
  currentUserId: string
  studioUsers: StudioUser[]
}

export function OverviewTab({
  project,
  taskCounts,
  upcomingTasks,
  userRole,
  currentUserId: _currentUserId,
  studioUsers: _studioUsers,
}: OverviewTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [localProject, setLocalProject] = useState(project)
  const [saving, setSaving] = useState(false)
  const [financeSummary, setFinanceSummary] = useState<{
    total_invoiced: number; total_cost: number; contract_value: number | null
  } | null>(null)
  const [contractValue, setContractValue] = useState<number | null>(project.contract_value ?? null)
  const [cvInput, setCvInput] = useState("")
  const [cvPopoverOpen, setCvPopoverOpen] = useState(false)
  const [savingCV, setSavingCV] = useState(false)

  const canEditFinance = userRole === "owner" || userRole === "senior_designer"
  const typeMeta   = TYPE_BADGE[localProject.type]   ?? TYPE_BADGE.other
  const statusMeta = STATUS_BADGE[localProject.status] ?? STATUS_BADGE.active
  const { start, end } = getProjectDates(localProject.phases)
  const daysRemaining = end ? differenceInDays(new Date(end), new Date()) : null

  // Load finance summary client-side
  useEffect(() => {
    if (!canEditFinance) return
    getProjectFinanceSummary(project.id)
      .then((s) => setFinanceSummary({ total_invoiced: s.total_invoiced, total_cost: s.total_cost, contract_value: s.contract_value }))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

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

      {/* Content */}
      <div className="p-6 flex flex-col gap-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tasks */}
          <Link href={`/dashboard/projects/${localProject.id}/tasks`} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          </Link>

          {/* Budget */}
          <Link href={`/dashboard/projects/${localProject.id}/finance`} className="block">
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${!canEditFinance ? "opacity-50" : ""}`}>
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
                      {contractValue != null ? (
                        `of ${contractValue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} contract`
                      ) : (
                        <Popover open={cvPopoverOpen} onOpenChange={setCvPopoverOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className="text-xs text-[#e94560] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Set contract value
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="start">
                            <div className="flex flex-col gap-2">
                              <span className="text-xs font-medium">Contract Value ₹</span>
                              <Input
                                type="number" min={0} value={cvInput}
                                onChange={(e) => setCvInput(e.target.value)}
                                placeholder="e.g. 500000" autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={handleSaveContractValue} disabled={savingCV}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setCvPopoverOpen(false)}>Cancel</Button>
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
          </Link>

          {/* Expenses */}
          <Link href={`/dashboard/projects/${localProject.id}/finance`} className="block">
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${!canEditFinance ? "opacity-50" : ""}`}>
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
          </Link>

          {/* Timeline */}
          <Link href={`/dashboard/projects/${localProject.id}/timeline`} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
                      {daysRemaining === null ? "—"
                        : daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue`
                        : `${daysRemaining} days remaining`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No timeline set</p>
                )}
              </CardContent>
            </Card>
          </Link>
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
                <p className="text-sm text-muted-foreground">No upcoming tasks — add tasks in the Tasks tab.</p>
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

          {/* Team */}
          <Card>
            <CardHeader>
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

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Project</SheetTitle>
          </SheetHeader>
          <EditProjectForm project={localProject} onSave={saveEdit} saving={saving} userRole={userRole} />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EditProjectForm({
  project,
  onSave,
  saving,
  userRole,
}: {
  project: Project
  onSave: (field: string, value: string) => void
  saving: boolean
  userRole: string
}) {
  const { toast } = useToast()
  const [name, setName] = useState(project.name)
  const [scopeDesc, setScopeDesc] = useState(project.scope_description ?? "")
  const [status, setStatus] = useState(project.status)
  const [pinterestUrl, setPinterestUrl] = useState(project.pinterest_url ?? "")
  const [narrativeFrequency, setNarrativeFrequency] = useState(project.narrative_frequency ?? "weekly")
  const [narrativeLanguage, setNarrativeLanguage] = useState(project.narrative_language ?? "en")
  const [savingNarrative, setSavingNarrative] = useState(false)

  const canEditNarrative = userRole === "owner" || userRole === "senior_designer"

  async function saveNarrativeSettings(frequency: string, language: string) {
    setSavingNarrative(true)
    try {
      await updateProjectNarrativeSettings(project.id, { frequency, language })
      toast({ title: "Client update settings saved" })
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" })
    } finally {
      setSavingNarrative(false)
    }
  }

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
        <Select value={status} onValueChange={(v) => { setStatus(v); onSave("status", v) }}>
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

      {/* Client Updates settings — owner/senior_designer only */}
      {canEditNarrative && (
        <div className="border border-border rounded-[8px] p-4 flex flex-col gap-3">
          <p className="text-sm font-medium">Client Updates</p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
            <Select
              value={narrativeFrequency}
              onValueChange={(v) => {
                setNarrativeFrequency(v)
                saveNarrativeSettings(v, narrativeLanguage)
              }}
            >
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Language</label>
            <Select
              value={narrativeLanguage}
              onValueChange={(v) => {
                setNarrativeLanguage(v)
                saveNarrativeSettings(narrativeFrequency, v)
              }}
            >
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="kn">Kannada</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {savingNarrative && <p className="text-xs text-muted-foreground">Saving…</p>}
        </div>
      )}

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  )
}
