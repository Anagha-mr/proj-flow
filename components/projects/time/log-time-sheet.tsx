"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { logTime, updateTimeEntry, type TimeEntry } from "@/app/actions/time-tracking"

interface LogTimeSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  projectPhases: Array<{ name: string }>
  currentUser: { id: string; name: string; role: string; hourly_rate: number | null }
  editEntry?: TimeEntry | null
  onSaved: (entry: TimeEntry) => void
}

export function LogTimeSheet({
  open,
  onOpenChange,
  projectId,
  projectPhases,
  currentUser,
  editEntry,
  onSaved,
}: LogTimeSheetProps) {
  const { toast } = useToast()
  const isEdit = !!editEntry

  const [date, setDate] = useState(editEntry?.entry_date ?? new Date().toISOString().split("T")[0])
  const [hours, setHours] = useState(editEntry ? String(editEntry.hours) : "")
  const [phase, setPhase] = useState(editEntry?.phase_tag ?? "none")
  const [billable, setBillable] = useState(editEntry?.is_billable ?? true)
  const [notes, setNotes] = useState(editEntry?.notes ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(editEntry?.entry_date ?? new Date().toISOString().split("T")[0])
    setHours(editEntry ? String(editEntry.hours) : "")
    setPhase(editEntry?.phase_tag ?? "none")
    setBillable(editEntry?.is_billable ?? true)
    setNotes(editEntry?.notes ?? "")
  }, [open, editEntry?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const noRate = !currentUser.hourly_rate || currentUser.hourly_rate === 0

  async function handleSave() {
    const h = parseFloat(hours)
    if (!date || isNaN(h) || h <= 0 || h > 24) {
      toast({ title: "Enter a valid date and hours (0.5–24)", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (isEdit && editEntry) {
        await updateTimeEntry(editEntry.id, {
          hours: h,
          phaseTag: phase === "none" ? undefined : phase,
          isBillable: billable,
          notes: notes || undefined,
          entryDate: date,
        })
        const updated: TimeEntry = { ...editEntry, hours: h, phase_tag: phase === "none" ? null : phase, is_billable: billable, notes: notes || null, entry_date: date }
        onSaved(updated)
        toast({ title: "Time entry updated" })
      } else {
        const entry = await logTime({
          projectId,
          entryDate: date,
          hours: h,
          phaseTag: phase === "none" ? undefined : phase,
          isBillable: billable,
          notes: notes || undefined,
        })
        onSaved(entry)
        toast({ title: "Time logged" })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Time Entry" : "Log Time"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          <div>
            <Label className="mb-1.5 block">Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Hours *</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              placeholder="e.g. 3.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Phase (optional)</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No phase</SelectItem>
                {projectPhases.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Billable</Label>
            <Switch checked={billable} onCheckedChange={setBillable} />
          </div>

          <div>
            <Label className="mb-1.5 block">Notes (optional)</Label>
            <Textarea
              placeholder="Any context about this work..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">{notes.length}/300</p>
          </div>
        </div>

        {noRate && (
          <div className="mt-4 border-l-4 border-amber-400 pl-3 py-2 bg-amber-50 rounded-r text-xs text-amber-800">
            Your hourly rate is not set. Time cost will show as ₹0. Ask your studio owner to update your profile.
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button
            className="w-full bg-[#e94560] hover:bg-[#c73652] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Log Time"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
