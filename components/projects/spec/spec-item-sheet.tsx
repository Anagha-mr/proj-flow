"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { createSpecItem, updateSpecItem, type SpecItem } from "@/app/actions/spec"

const SURFACES = [
  { value: "floor", label: "Floor" },
  { value: "wall", label: "Wall" },
  { value: "ceiling", label: "Ceiling" },
  { value: "joinery", label: "Joinery" },
  { value: "other", label: "Other" },
] as const

interface SpecItemSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  existingSpaces: string[]
  editItem?: SpecItem | null
  defaultSpace?: string
  onSaved: (item: SpecItem) => void
}

export function SpecItemSheet({
  open,
  onOpenChange,
  projectId,
  existingSpaces,
  editItem,
  defaultSpace,
  onSaved,
}: SpecItemSheetProps) {
  const { toast } = useToast()
  const isEdit = !!editItem

  const [space, setSpace] = useState(editItem?.space ?? defaultSpace ?? "")
  const [surface, setSurface] = useState<SpecItem["surface"]>(editItem?.surface ?? "floor")
  const [materialName, setMaterialName] = useState(editItem?.material_name ?? "")
  const [finishType, setFinishType] = useState(editItem?.finish_type ?? "")
  const [supplier, setSupplier] = useState(editItem?.supplier ?? "")
  const [dimensions, setDimensions] = useState(editItem?.dimensions ?? "")
  const [locationNotes, setLocationNotes] = useState(editItem?.location_notes ?? "")
  const [drawingRef, setDrawingRef] = useState(editItem?.drawing_reference ?? "")
  const [reason, setReason] = useState("")
  const [revHistoryOpen, setRevHistoryOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editItem) {
      setSpace(editItem.space)
      setSurface(editItem.surface)
      setMaterialName(editItem.material_name)
      setFinishType(editItem.finish_type ?? "")
      setSupplier(editItem.supplier ?? "")
      setDimensions(editItem.dimensions ?? "")
      setLocationNotes(editItem.location_notes ?? "")
      setDrawingRef(editItem.drawing_reference ?? "")
      setReason("")
    } else {
      setSpace(defaultSpace ?? "")
      setSurface("floor")
      setMaterialName("")
      setFinishType("")
      setSupplier("")
      setDimensions("")
      setLocationNotes("")
      setDrawingRef("")
      setReason("")
    }
  }, [editItem, defaultSpace, open])

  const hasChanged = isEdit && editItem && (
    space !== editItem.space ||
    surface !== editItem.surface ||
    materialName !== editItem.material_name ||
    finishType !== (editItem.finish_type ?? "") ||
    supplier !== (editItem.supplier ?? "") ||
    dimensions !== (editItem.dimensions ?? "") ||
    locationNotes !== (editItem.location_notes ?? "") ||
    drawingRef !== (editItem.drawing_reference ?? "")
  )

  async function handleSave() {
    if (!space.trim() || !materialName.trim()) {
      toast({ title: "Space and material name are required", variant: "destructive" })
      return
    }
    if (isEdit && hasChanged && !reason.trim()) {
      toast({ title: "Please enter a reason for the change", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (isEdit && editItem) {
        const updated = await updateSpecItem(
          editItem.id,
          {
            space: space.trim(),
            surface,
            material_name: materialName.trim(),
            finish_type: finishType.trim() || null,
            supplier: supplier.trim() || null,
            dimensions: dimensions.trim() || null,
            location_notes: locationNotes.trim() || null,
            drawing_reference: drawingRef.trim() || null,
          },
          reason
        )
        onSaved(updated)
        toast({ title: "Spec item updated" })
      } else {
        const item = await createSpecItem({
          projectId,
          space: space.trim(),
          surface,
          materialName: materialName.trim(),
          finishType: finishType.trim() || undefined,
          supplier: supplier.trim() || undefined,
          dimensions: dimensions.trim() || undefined,
          locationNotes: locationNotes.trim() || undefined,
          drawingReference: drawingRef.trim() || undefined,
        })
        onSaved(item)
        toast({ title: "Spec item added" })
      }
      onOpenChange(false)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const revisions = editItem?.revisions ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Spec Item" : "Add Spec Item"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div>
            <Label className="mb-1.5 block">Space *</Label>
            <Input
              list="space-suggestions"
              placeholder="e.g. Living Room"
              value={space}
              onChange={(e) => setSpace(e.target.value)}
            />
            <datalist id="space-suggestions">
              {existingSpaces.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <Label className="mb-1.5 block">Surface *</Label>
            <Select value={surface} onValueChange={(v) => setSurface(v as SpecItem["surface"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SURFACES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Material Name *</Label>
            <Input placeholder="e.g. Italian Marble" value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Finish Type</Label>
            <Input placeholder="e.g. Polished, Matt, Honed" value={finishType} onChange={(e) => setFinishType(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Supplier</Label>
            <Input placeholder="e.g. Rajasthan Tiles Co." value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Dimensions</Label>
            <Input placeholder="e.g. 600×600mm" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block">Location Notes</Label>
            <Textarea placeholder="Any location-specific notes..." value={locationNotes} onChange={(e) => setLocationNotes(e.target.value)} rows={2} />
          </div>

          <div>
            <Label className="mb-1.5 block">Drawing Reference</Label>
            <Input placeholder="e.g. DWG-FL-01" value={drawingRef} onChange={(e) => setDrawingRef(e.target.value)} />
          </div>

          {editItem?.linked_procurement_id && (
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs px-3 py-1.5 rounded-full w-fit">
              <span>Imported from procurement</span>
            </div>
          )}

          {isEdit && (
            <div className="border-l-4 border-amber-400 pl-3 py-2 bg-amber-50 rounded-r">
              <Label className="mb-1.5 block text-amber-800">Reason for change {hasChanged ? "*" : "(required if editing)"}</Label>
              <Input
                placeholder="e.g. Client requested local sourcing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-amber-300 focus-visible:ring-amber-400"
              />
            </div>
          )}
        </div>

        {isEdit && revisions.length > 0 && (
          <div className="mt-6">
            <button
              className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
              onClick={() => setRevHistoryOpen((v) => !v)}
            >
              {revHistoryOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Revision History ({revisions.length} change{revisions.length > 1 ? "s" : ""})
            </button>
            {revHistoryOpen && (
              <div className="mt-3 flex flex-col gap-3">
                {[...revisions].reverse().map((rev, idx) => (
                  <div key={idx} className="border-l-2 border-gray-200 pl-3 text-xs">
                    <p className="text-muted-foreground">
                      {format(new Date(rev.changed_at), "d MMM yyyy")} · changed <strong>{rev.field_name}</strong>
                    </p>
                    <p className="mt-0.5">
                      <span className="line-through text-red-400">{rev.old_value || "—"}</span>
                      {" → "}
                      <span className="text-green-700 font-medium">{rev.new_value || "—"}</span>
                    </p>
                    <p className="text-muted-foreground italic mt-0.5">Reason: {rev.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button
            className="w-full bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
