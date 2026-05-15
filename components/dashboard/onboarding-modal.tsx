"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { INDIAN_STATES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Upload, X, Check, ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react"

// ─── GSTIN Checksum Validation ────────────────────────────────
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function validateGSTIN(gstin: string): boolean {
  if (!GSTIN_REGEX.test(gstin)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const val = GSTIN_CHARS.indexOf(gstin[i])
    if (val === -1) return false
    const factor = i % 2 === 0 ? 1 : 2
    const product = val * factor
    sum += Math.floor(product / 36) + (product % 36)
  }
  return GSTIN_CHARS[sum % 36] === gstin[14]
}

// ─── Types ────────────────────────────────────────────────────
interface InviteRow {
  email: string
  role: "senior_designer" | "designer" | "intern"
}

interface Props {
  studioId: string
  studioName: string
}

type StepId = 0 | 1 | 2 | 3

const STEPS = ["Studio Identity", "Business Details", "Invite Team", "WhatsApp"] as const

// ─── Step indicator ───────────────────────────────────────────
function StepIndicator({ current }: { current: StepId }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors",
              i < current
                ? "bg-accent text-accent-foreground"
                : i === current
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {i < current ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span className={cn("text-xs hidden sm:inline", i === current ? "font-medium" : "text-muted-foreground")}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Studio Identity ──────────────────────────────────
function Step1({
  studioName,
  logoPreview,
  onNameChange,
  onLogoChange,
  onLogoRemove,
}: {
  studioName: string
  logoPreview: string | null
  onNameChange: (v: string) => void
  onLogoChange: (file: File) => void
  onLogoRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) onLogoChange(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onLogoChange(file)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Logo upload */}
      <div className="flex flex-col gap-2">
        <Label>Studio logo</Label>
        {logoPreview ? (
          <div className="relative w-24 h-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="Studio logo" className="w-24 h-24 rounded-xl object-cover border border-border" />
            <button
              type="button"
              onClick={onLogoRemove}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <Upload className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Drag & drop or <span className="text-primary font-medium">click to upload</span></p>
            <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG up to 2 MB</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Studio name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studio_name">Studio name *</Label>
        <Input
          id="studio_name"
          value={studioName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Studio Kasa"
          required
        />
      </div>
    </div>
  )
}

// ─── Step 2: Business Details ─────────────────────────────────
function Step2({
  data,
  onChange,
  gstinError,
}: {
  data: {
    gstin: string
    state_code: string
    address_line1: string
    address_line2: string
    address_line3: string
    postcode: string
    contact_phone: string
  }
  onChange: (patch: Partial<typeof data>) => void
  gstinError: string
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* GSTIN */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gstin">GSTIN</Label>
        <Input
          id="gstin"
          value={data.gstin}
          onChange={e => onChange({ gstin: e.target.value.toUpperCase() })}
          placeholder="29AAAAA0000A1Z5"
          maxLength={15}
        />
        {gstinError && <p className="text-xs text-destructive">{gstinError}</p>}
        {data.gstin.length === 15 && !gstinError && (
          <p className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Valid GSTIN</p>
        )}
        <p className="text-xs text-muted-foreground">15-character GST Identification Number. Used on all invoices.</p>
      </div>

      {/* State */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state_code">State *</Label>
        <select
          id="state_code"
          value={data.state_code}
          onChange={e => onChange({ state_code: e.target.value })}
          className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        >
          <option value="">Select state…</option>
          {INDIAN_STATES.map(s => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Determines CGST+SGST vs IGST on invoices.</p>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="addr1">Address line 1</Label>
        <Input id="addr1" value={data.address_line1} onChange={e => onChange({ address_line1: e.target.value })} placeholder="Office 4B, Manyata Tech Park" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addr2">Line 2</Label>
          <Input id="addr2" value={data.address_line2} onChange={e => onChange({ address_line2: e.target.value })} placeholder="Outer Ring Road" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addr3">Line 3 / Area</Label>
          <Input id="addr3" value={data.address_line3} onChange={e => onChange({ address_line3: e.target.value })} placeholder="Bengaluru" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postcode">Postcode</Label>
          <Input id="postcode" value={data.postcode} onChange={e => onChange({ postcode: e.target.value })} placeholder="560045" maxLength={6} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Contact phone</Label>
          <Input id="phone" type="tel" value={data.contact_phone} onChange={e => onChange({ contact_phone: e.target.value })} placeholder="+91 98765 43210" />
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Invite Team ──────────────────────────────────────
function Step3({
  invites,
  onChange,
}: {
  invites: InviteRow[]
  onChange: (rows: InviteRow[]) => void
}) {
  function addRow() {
    if (invites.length >= 5) return
    onChange([...invites, { email: "", role: "designer" }])
  }

  function removeRow(i: number) {
    onChange(invites.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, patch: Partial<InviteRow>) {
    onChange(invites.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Invite up to 5 team members now. They'll receive an email with a signup link.
        You can always do this later in Settings.
      </p>

      <div className="flex flex-col gap-3">
        {invites.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="team@studio.com"
              value={row.email}
              onChange={e => updateRow(i, { email: e.target.value })}
              className="flex-1"
            />
            <select
              value={row.role}
              onChange={e => updateRow(i, { role: e.target.value as InviteRow["role"] })}
              className="h-9 rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="senior_designer">Senior Designer</option>
              <option value="designer">Designer</option>
              <option value="intern">Intern</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {invites.length < 5 && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit">
          <Plus className="w-3 h-3" />
          Add team member
        </Button>
      )}
    </div>
  )
}

// ─── Step 4: WhatsApp Integration ────────────────────────────
function Step4({
  watiUrl,
  watiKey,
  onWatiUrlChange,
  onWatiKeyChange,
}: {
  watiUrl: string
  watiKey: string
  onWatiUrlChange: (v: string) => void
  onWatiKeyChange: (v: string) => void
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Connect your studio&apos;s WhatsApp Business number to automatically notify clients about
        invoices, procurement approvals, and site updates. You&apos;ll need a{" "}
        <span className="font-medium">Wati.io</span> account with a verified WhatsApp Business number.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">WATI API URL</label>
        <input
          value={watiUrl}
          onChange={(e) => onWatiUrlChange(e.target.value)}
          placeholder="live-mt-server.wati.io"
          className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">Host from your WATI dashboard — no https:// prefix.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">WATI API Key</label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={watiKey}
            onChange={(e) => onWatiKeyChange(e.target.value)}
            placeholder="eyJ..."
            className="flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/50 px-3 py-2">
        You can skip this step and connect later via{" "}
        <span className="font-medium">Settings → Integrations</span>.
      </p>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────
export function OnboardingModal({ studioId, studioName: initialStudioName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<StepId>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Step 1 state
  const [studioName, setStudioName] = useState(initialStudioName)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Step 2 state
  const [bizData, setBizData] = useState({
    gstin: "",
    state_code: "",
    address_line1: "",
    address_line2: "",
    address_line3: "",
    postcode: "",
    contact_phone: "",
  })
  const [gstinError, setGstinError] = useState("")

  // Step 3 state
  const [invites, setInvites] = useState<InviteRow[]>([])

  // Step 4 state
  const [watiUrl, setWatiUrl] = useState("")
  const [watiKey, setWatiKey] = useState("")

  // ── Handlers ──────────────────────────────────────────────
  function handleLogoChange(file: File) {
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleLogoRemove() {
    setLogoFile(null)
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(null)
  }

  function handleGstinChange(patch: Partial<typeof bizData>) {
    setBizData(prev => ({ ...prev, ...patch }))
    if ("gstin" in patch && patch.gstin) {
      const v = patch.gstin as string
      if (v.length === 15) {
        setGstinError(validateGSTIN(v) ? "" : "Invalid GSTIN — checksum failed. Please double-check.")
      } else if (v.length > 0) {
        setGstinError("")
      }
    }
  }

  // ── Complete onboarding ───────────────────────────────────
  const completeOnboarding = useCallback(async (skipInvites = false) => {
    setSaving(true)
    setError("")

    const supabase = createClient()

    try {
      let logoUrl: string | null = null

      // Upload logo if provided
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()
        const path = `${studioId}/logo/logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("projectflow-files")
          .upload(path, logoFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("projectflow-files")
            .getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      // Update studio record
      const { error: updateError } = await supabase
        .from("studios")
        .update({
          name: studioName.trim() || initialStudioName,
          ...(logoUrl && { logo_url: logoUrl }),
          gstin: bizData.gstin || null,
          state_code: bizData.state_code || null,
          address_line1: bizData.address_line1 || null,
          address_line2: bizData.address_line2 || null,
          address_line3: bizData.address_line3 || null,
          postcode: bizData.postcode || null,
          contact_phone: bizData.contact_phone || null,
          onboarding_complete: true,
          ...(watiUrl.trim() && { wati_api_url: watiUrl.trim() }),
          ...(watiKey.trim() && { wati_api_key: watiKey.trim() }),
        })
        .eq("id", studioId)

      if (updateError) throw new Error(updateError.message)

      // Send invites (non-blocking — ignore individual failures)
      if (!skipInvites && invites.length > 0) {
        const validInvites = invites.filter(r => r.email.trim())
        await Promise.allSettled(
          validInvites.map(async invite => {
            await supabase.from("invitations").insert({
              studio_id: studioId,
              email: invite.email.trim(),
              role: invite.role,
            })
          })
        )
      }

      setOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }, [studioId, studioName, initialStudioName, logoFile, bizData, invites, watiUrl, watiKey, router])

  // ── Step navigation ───────────────────────────────────────
  function handleNext() {
    if (step === 0) {
      if (!studioName.trim()) { setError("Studio name is required"); return }
      setError("")
      setStep(1)
    } else if (step === 1) {
      if (bizData.gstin && bizData.gstin.length === 15 && !validateGSTIN(bizData.gstin)) {
        setGstinError("Invalid GSTIN — checksum failed. Please double-check.")
        return
      }
      if (!bizData.state_code) { setError("Please select your state"); return }
      setError("")
      setStep(2)
    } else if (step === 2) {
      setError("")
      setStep(3)
    }
  }

  function handleBack() {
    setError("")
    setStep(prev => (prev - 1) as StepId)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <CardContent className="pt-8 pb-6 px-6 flex flex-col gap-0">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-3">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Set up your studio</h2>
            <p className="text-sm text-muted-foreground mt-1">Takes about 2 minutes. You can update everything later.</p>
          </div>

          <StepIndicator current={step} />

          {/* Step content */}
          <div className="flex flex-col gap-4">
            {step === 0 && (
              <Step1
                studioName={studioName}
                logoPreview={logoPreview}
                onNameChange={setStudioName}
                onLogoChange={handleLogoChange}
                onLogoRemove={handleLogoRemove}
              />
            )}
            {step === 1 && (
              <Step2
                data={bizData}
                onChange={handleGstinChange}
                gstinError={gstinError}
              />
            )}
            {step === 2 && (
              <Step3 invites={invites} onChange={setInvites} />
            )}
            {step === 3 && (
              <Step4
                watiUrl={watiUrl}
                watiKey={watiKey}
                onWatiUrlChange={setWatiUrl}
                onWatiKeyChange={setWatiKey}
              />
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={saving} className="flex-none">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}

            {step < 3 && (
              <Button onClick={handleNext} disabled={saving} className="flex-1">
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {step === 3 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => completeOnboarding(true)}
                  disabled={saving}
                  className="flex-1"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={() => completeOnboarding(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? "Launching…" : "Launch studio"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
