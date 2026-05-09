"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createProject } from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  X, ChevronRight, ChevronLeft, Upload, Trash2, Plus, Check,
  ImageIcon, Users, Layers, FileText, User,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────
interface Phase {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  color: string
}

interface ScopeItem {
  id: string
  text: string
}

interface MemberSelection {
  userId: string
  projectRole: string
}

interface WizardState {
  // Step 1
  coverImageFile: File | null
  coverImagePreview: string | null
  name: string
  type: string
  typeCustom: string
  status: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  postcode: string
  pinterestUrl: string
  // Step 2
  scopeDescription: string
  scopeItems: ScopeItem[]
  // Step 3
  phases: Phase[]
  // Step 4
  selectedMembers: MemberSelection[]
  // Step 5
  clientId: string | null
  newClientMode: boolean
  newClientName: string
  newClientWhatsapp: string
  newClientEmail: string
  templateId: string | null
}

type StudioUser = { id: string; name: string; email: string; role: string; profile_photo_url: string | null }
type ClientRow  = { id: string; name: string; company: string | null; email: string | null; phone_primary: string | null; whatsapp_number: string | null }
type TemplateRow = { id: string; name: string; project_type: string; is_default: boolean; tasks: unknown; phases: unknown }

const PHASE_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#e94560"]
const DEFAULT_PHASES: Phase[] = [
  { id: "p1", name: "Concept",            start_date: "", end_date: "", status: "pending", color: "#6366f1" },
  { id: "p2", name: "Design Development", start_date: "", end_date: "", status: "pending", color: "#8b5cf6" },
  { id: "p3", name: "Procurement",        start_date: "", end_date: "", status: "pending", color: "#f59e0b" },
  { id: "p4", name: "Execution",          start_date: "", end_date: "", status: "pending", color: "#10b981" },
  { id: "p5", name: "Handover",           start_date: "", end_date: "", status: "pending", color: "#e94560" },
]

const PROJECT_ROLES = [
  { value: "project_lead",    label: "Project Lead" },
  { value: "senior_designer", label: "Senior Designer" },
  { value: "designer",        label: "Designer" },
  { value: "intern",          label: "Intern" },
  { value: "site_coordinator",label: "Site Coordinator" },
]

const STEPS = [
  { label: "Basics",   icon: FileText },
  { label: "Scope",    icon: Layers },
  { label: "Timeline", icon: Layers },
  { label: "Team",     icon: Users },
  { label: "Client",   icon: User },
]

function uid() { return Math.random().toString(36).slice(2) }

// ─── Main Wizard Component ────────────────────────────────────
export function ProjectWizard({
  currentUserId,
  studioId,
  clients,
  templates,
  studioUsers,
}: {
  currentUserId: string
  studioId: string
  clients: ClientRow[]
  templates: TemplateRow[]
  studioUsers: StudioUser[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [state, setState] = useState<WizardState>({
    coverImageFile: null,
    coverImagePreview: null,
    name: "",
    type: "residential",
    typeCustom: "",
    status: "active",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    postcode: "",
    pinterestUrl: "",
    scopeDescription: "",
    scopeItems: [],
    phases: DEFAULT_PHASES.map((p) => ({ ...p })),
    selectedMembers: [{ userId: currentUserId, projectRole: "project_lead" }],
    clientId: null,
    newClientMode: false,
    newClientName: "",
    newClientWhatsapp: "",
    newClientEmail: "",
    templateId: null,
  })

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // ── Validation ──────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!state.name.trim()) errs.name = "Project name is required"
    if (state.type === "other" && !state.typeCustom.trim()) errs.typeCustom = "Custom type is required"

    if (step >= 3) {
      state.phases.forEach((phase, i) => {
        if (phase.start_date && phase.end_date && phase.end_date <= phase.start_date) {
          errs[`phase_${i}_end`] = "End date must be after start date"
        }
      })
    }

    if (step === 5 && state.newClientMode && !state.newClientName.trim()) {
      errs.newClientName = "Client name is required"
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function next() {
    if (!validate()) return
    setStep((s) => Math.min(s + 1, 5))
  }

  function back() { setStep((s) => Math.max(s - 1, 1)) }

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)

    try {
      let coverImageUrl: string | null = null

      // Upload cover image
      if (state.coverImageFile) {
        const supabase = createClient()
        const ext = state.coverImageFile.name.split(".").pop() ?? "jpg"
        const tempId = uid()
        const path = `${studioId}/projects/${tempId}/cover.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("projectflow-files")
          .upload(path, state.coverImageFile, { upsert: true })

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("projectflow-files")
            .getPublicUrl(uploadData.path)
          coverImageUrl = urlData.publicUrl
        }
      }

      const project = await createProject({
        name: state.name.trim(),
        type: state.type,
        type_custom: state.type === "other" ? state.typeCustom.trim() : null,
        status: state.status,
        address_line1: state.addressLine1 || null,
        address_line2: state.addressLine2 || null,
        address_line3: state.addressLine3 || null,
        postcode: state.postcode || null,
        cover_image_url: coverImageUrl,
        scope_description: state.scopeDescription || null,
        scope_items: state.scopeItems.filter((i) => i.text.trim()),
        phases: state.phases.filter((p) => p.start_date && p.end_date),
        template_id: state.templateId || null,
        client_id: state.clientId,
        pinterest_url: state.pinterestUrl || null,
        members: state.selectedMembers,
        newClient: state.newClientMode && state.newClientName.trim()
          ? { name: state.newClientName, whatsapp_number: state.newClientWhatsapp || undefined, email: state.newClientEmail || undefined }
          : null,
      })

      toast({ title: "Project created successfully", variant: "success" } as Parameters<typeof toast>[0])
      router.push(`/dashboard/projects/${project.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create project"
      toast({ title: msg, variant: "destructive" } as Parameters<typeof toast>[0])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const n = i + 1
              const active = n === step
              const done = n < step
              return (
                <div key={n} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#e94560] text-white"
                        : done
                        ? "bg-[#1a1a2e] text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : <span>{n}</span>}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && <Step1 state={state} set={set} errors={errors} />}
          {step === 2 && <Step2 state={state} set={set} />}
          {step === 3 && <Step3 state={state} set={set} errors={errors} />}
          {step === 4 && <Step4 state={state} set={set} studioUsers={studioUsers} currentUserId={currentUserId} />}
          {step === 5 && <Step5 state={state} set={set} clients={clients} templates={templates} errors={errors} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={back} disabled={step === 1}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          {step < 5 ? (
            <Button onClick={next} style={{ backgroundColor: "#e94560" }} className="hover:opacity-90">
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ backgroundColor: "#e94560" }}
              className="hover:opacity-90"
            >
              {submitting ? "Creating…" : "Create Project"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 1: Project Basics ───────────────────────────────────
function Step1({
  state,
  set,
  errors,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  errors: Record<string, string>
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.type.match(/image\/(jpeg|png|webp)/)) return
    const reader = new FileReader()
    reader.onload = (e) => set("coverImagePreview", e.target?.result as string)
    reader.readAsDataURL(file)
    set("coverImageFile", file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const PROJECT_TYPES = [
    { value: "residential", label: "Residential" },
    { value: "commercial",  label: "Commercial" },
    { value: "hospitality", label: "Hospitality" },
    { value: "retail",      label: "Retail" },
    { value: "other",       label: "Other" },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Cover image */}
      <div>
        <label className="text-sm font-medium mb-2 block">Cover Image</label>
        <div
          className="border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-[#e94560] transition-colors"
          style={{ aspectRatio: "16/9", maxHeight: 200 }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          {state.coverImagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.coverImagePreview} alt="Cover preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="w-8 h-8" />
              <span className="text-sm">Drag & drop or click to upload</span>
              <span className="text-xs">JPG, PNG, WEBP</span>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {/* Project name */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Project Name *</label>
        <Input
          value={state.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Sharma Residence — Phase 1"
          className={`focus-visible:ring-[#e94560] ${errors.name ? "border-destructive" : ""}`}
        />
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
      </div>

      {/* Project type */}
      <div>
        <label className="text-sm font-medium mb-2 block">Project Type</label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => set("type", t.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                state.type === t.value
                  ? "border-[#e94560] bg-[#e94560]/10 text-[#e94560]"
                  : "border-input text-muted-foreground hover:border-[#e94560]/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {state.type === "other" && (
          <div className="mt-2">
            <Input
              value={state.typeCustom}
              onChange={(e) => set("typeCustom", e.target.value)}
              placeholder="Describe the project type"
              className={`focus-visible:ring-[#e94560] ${errors.typeCustom ? "border-destructive" : ""}`}
            />
            {errors.typeCustom && <p className="text-xs text-destructive mt-1">{errors.typeCustom}</p>}
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="text-sm font-medium mb-2 block">Status</label>
        <div className="flex gap-2">
          {["active", "on_hold"].map((s) => (
            <button
              key={s}
              onClick={() => set("status", s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                state.status === s
                  ? "border-[#e94560] bg-[#e94560]/10 text-[#e94560]"
                  : "border-input text-muted-foreground"
              }`}
            >
              {s === "active" ? "Active" : "On Hold"}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Address</label>
        <div className="flex flex-col gap-2">
          <Input
            value={state.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
            placeholder="Address Line 1"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={state.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
            placeholder="Address Line 2"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={state.addressLine3}
            onChange={(e) => set("addressLine3", e.target.value)}
            placeholder="Address Line 3"
            className="focus-visible:ring-[#e94560]"
          />
          <Input
            value={state.postcode}
            onChange={(e) => set("postcode", e.target.value)}
            placeholder="Postcode"
            className="focus-visible:ring-[#e94560]"
          />
        </div>
      </div>

      {/* Pinterest URL */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Pinterest / Reference URL</label>
        <Input
          value={state.pinterestUrl}
          onChange={(e) => set("pinterestUrl", e.target.value)}
          placeholder="https://pinterest.com/…"
          className="focus-visible:ring-[#e94560]"
        />
      </div>
    </div>
  )
}

// ─── Step 2: Scope of Work ────────────────────────────────────
function Step2({
  state,
  set,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
}) {
  function addItem() {
    set("scopeItems", [...state.scopeItems, { id: uid(), text: "" }])
  }

  function updateItem(id: string, text: string) {
    set("scopeItems", state.scopeItems.map((i) => i.id === id ? { ...i, text } : i))
  }

  function removeItem(id: string) {
    set("scopeItems", state.scopeItems.filter((i) => i.id !== id))
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Scope Description</label>
        <Textarea
          value={state.scopeDescription}
          onChange={(e) => set("scopeDescription", e.target.value)}
          placeholder="Describe the overall scope of this project…"
          rows={5}
          className="focus-visible:ring-[#e94560]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Scope Items</label>
          <button
            onClick={addItem}
            className="flex items-center gap-1 text-xs text-[#e94560] font-medium hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add item
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.scopeItems.map((item) => (
            <div key={item.id} className="flex gap-2 items-center">
              <Input
                value={item.text}
                onChange={(e) => updateItem(item.id, e.target.value)}
                placeholder="e.g. Living room interior design"
                className="flex-1 focus-visible:ring-[#e94560]"
              />
              <button
                onClick={() => removeItem(item.id)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {state.scopeItems.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No scope items yet. Click "+ Add item" to add deliverables.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Phases & Timeline ────────────────────────────────
function Step3({
  state,
  set,
  errors,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  errors: Record<string, string>
}) {
  function updatePhase(id: string, field: keyof Phase, value: string) {
    set("phases", state.phases.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  function addPhase() {
    const colorIdx = state.phases.length % PHASE_COLORS.length
    set("phases", [
      ...state.phases,
      { id: uid(), name: "New Phase", start_date: "", end_date: "", status: "pending", color: PHASE_COLORS[colorIdx] },
    ])
  }

  function removePhase(id: string) {
    if (state.phases.length <= 1) return
    set("phases", state.phases.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Define the project phases and their date ranges. At least one phase with dates is required to create the project.
      </p>

      {state.phases.map((phase, i) => (
        <div key={phase.id} className="border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: phase.color }}
            />
            <Input
              value={phase.name}
              onChange={(e) => updatePhase(phase.id, "name", e.target.value)}
              placeholder="Phase name"
              className="flex-1 focus-visible:ring-[#e94560]"
            />
            <button
              onClick={() => removePhase(phase.id)}
              disabled={state.phases.length <= 1}
              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Input
                type="date"
                value={phase.start_date}
                onChange={(e) => updatePhase(phase.id, "start_date", e.target.value)}
                className="focus-visible:ring-[#e94560]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Input
                type="date"
                value={phase.end_date}
                onChange={(e) => updatePhase(phase.id, "end_date", e.target.value)}
                className={`focus-visible:ring-[#e94560] ${errors[`phase_${i}_end`] ? "border-destructive" : ""}`}
              />
              {errors[`phase_${i}_end`] && (
                <p className="text-xs text-destructive mt-1">{errors[`phase_${i}_end`]}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addPhase}
        className="flex items-center gap-2 text-sm text-[#e94560] font-medium hover:opacity-80 transition-opacity self-start"
      >
        <Plus className="w-4 h-4" />
        Add phase
      </button>
    </div>
  )
}

// ─── Step 4: Team Assignment ──────────────────────────────────
function Step4({
  state,
  set,
  studioUsers,
  currentUserId,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  studioUsers: StudioUser[]
  currentUserId: string
}) {
  const isSelected = (userId: string) => state.selectedMembers.some((m) => m.userId === userId)

  function toggle(user: StudioUser) {
    if (user.id === currentUserId) return // cannot remove creator
    if (isSelected(user.id)) {
      set("selectedMembers", state.selectedMembers.filter((m) => m.userId !== user.id))
    } else {
      set("selectedMembers", [...state.selectedMembers, { userId: user.id, projectRole: "designer" }])
    }
  }

  function updateRole(userId: string, role: string) {
    set("selectedMembers", state.selectedMembers.map((m) => m.userId === userId ? { ...m, projectRole: role } : m))
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner", senior_designer: "Senior Designer", designer: "Designer", intern: "Intern",
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Click a team member to assign them to this project. You are pre-selected as Project Lead.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {studioUsers.map((user) => {
          const selected = isSelected(user.id)
          const isCreator = user.id === currentUserId
          const member = state.selectedMembers.find((m) => m.userId === user.id)
          return (
            <div
              key={user.id}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                selected ? "border-[#e94560] bg-[#e94560]/5" : "hover:border-muted-foreground/40"
              } ${isCreator ? "opacity-80" : ""}`}
              onClick={() => toggle(user)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className="bg-[#1a1a2e] text-white text-xs">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    {isCreator && <span className="text-[10px] text-muted-foreground">(you)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                </div>
                {selected && <Check className="w-4 h-4 text-[#e94560] shrink-0" />}
              </div>

              {selected && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={member?.projectRole ?? "designer"}
                    onValueChange={(v) => updateRole(user.id, v)}
                  >
                    <SelectTrigger className="h-8 text-xs focus:ring-[#e94560]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 5: Client & Template ────────────────────────────────
function Step5({
  state,
  set,
  clients,
  templates,
  errors,
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  clients: ClientRow[]
  templates: TemplateRow[]
  errors: Record<string, string>
}) {
  function getTaskCount(template: TemplateRow): number {
    if (!Array.isArray(template.tasks)) return 0
    return (template.tasks as unknown[]).length
  }

  function getTemplatePhaseSummary(template: TemplateRow): string {
    if (!Array.isArray(template.phases)) return ""
    const phases = template.phases as Array<{ name: string }>
    return phases.map((p) => p.name).join(" → ")
  }

  const TYPE_LABEL: Record<string, string> = {
    residential: "Residential", commercial: "Commercial", hospitality: "Hospitality",
    retail: "Retail", other: "Other",
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Client linking */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Link Client (Optional)</h3>
        <div className="flex flex-col gap-2">
          <Select
            value={state.clientId ?? "none"}
            onValueChange={(v) => {
              if (v === "add_new") {
                set("newClientMode", true)
                set("clientId", null)
              } else {
                set("newClientMode", false)
                set("clientId", v === "none" ? null : v)
              }
            }}
          >
            <SelectTrigger className="focus:ring-[#e94560]">
              <SelectValue placeholder="Select a client…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ""}
                </SelectItem>
              ))}
              <SelectItem value="add_new" className="text-[#e94560] font-medium">
                + Add new client
              </SelectItem>
            </SelectContent>
          </Select>

          {state.newClientMode && (
            <div className="border rounded-lg p-4 flex flex-col gap-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Client</p>
              <div>
                <Input
                  value={state.newClientName}
                  onChange={(e) => set("newClientName", e.target.value)}
                  placeholder="Client name *"
                  className={`focus-visible:ring-[#e94560] ${errors.newClientName ? "border-destructive" : ""}`}
                />
                {errors.newClientName && (
                  <p className="text-xs text-destructive mt-1">{errors.newClientName}</p>
                )}
              </div>
              <Input
                value={state.newClientWhatsapp}
                onChange={(e) => set("newClientWhatsapp", e.target.value)}
                placeholder="WhatsApp number"
                className="focus-visible:ring-[#e94560]"
              />
              <Input
                value={state.newClientEmail}
                onChange={(e) => set("newClientEmail", e.target.value)}
                placeholder="Email address"
                className="focus-visible:ring-[#e94560]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Process template */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Process Template (Optional)</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Selecting a template will auto-create tasks for this project.
        </p>

        <div className="flex flex-col gap-2">
          {/* No template option */}
          <div
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              state.templateId === null
                ? "border-[#e94560] bg-[#e94560]/5"
                : "hover:border-muted-foreground/40"
            }`}
            onClick={() => set("templateId", null)}
          >
            <div className="flex items-center gap-2">
              {state.templateId === null && <Check className="w-4 h-4 text-[#e94560]" />}
              <div>
                <p className="text-sm font-medium">No template</p>
                <p className="text-xs text-muted-foreground">Add tasks manually in the Tasks tab</p>
              </div>
            </div>
          </div>

          {templates.map((t) => {
            const selected = state.templateId === t.id
            return (
              <div
                key={t.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selected ? "border-[#e94560] bg-[#e94560]/5" : "hover:border-muted-foreground/40"
                }`}
                onClick={() => set("templateId", t.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {selected && <Check className="w-4 h-4 text-[#e94560] shrink-0" />}
                      <p className="text-sm font-medium">{t.name}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {TYPE_LABEL[t.project_type] ?? t.project_type}
                      </span>
                      <span className="text-xs text-muted-foreground">{getTaskCount(t)} tasks</span>
                    </div>
                  </div>
                </div>
                {selected && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">{getTemplatePhaseSummary(t)}</p>
                  </div>
                )}
              </div>
            )
          })}

          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No templates yet. A default template will be created when you set up your studio.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
