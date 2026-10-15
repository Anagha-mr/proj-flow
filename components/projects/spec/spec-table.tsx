"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Trash2, Plus, History } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { deleteSpecItem, type SpecItem, type SpecRevision } from "@/app/actions/spec"

const FIELD_LABELS: Record<string, string> = {
  space: "Space",
  surface: "Surface",
  material_name: "Material Name",
  finish_type: "Finish Type",
  supplier: "Supplier",
  supplier_vendor_id: "Supplier",
  location_notes: "Location Notes",
  dimensions: "Dimensions",
  drawing_reference: "Drawing Reference",
  drawing_reference_document_id: "Drawing Reference",
  linked_procurement_id: "Linked Procurement Item",
}

const SURFACES = [
  { value: "floor", label: "Floor" },
  { value: "wall", label: "Wall" },
  { value: "ceiling", label: "Ceiling" },
  { value: "joinery", label: "Joinery" },
  { value: "other", label: "Other" },
] as const

const NONE = "__none__"

interface LookupOption {
  id: string
  name: string
}

interface SpecTableProps {
  items: SpecItem[]
  canManage: boolean
  vendors: LookupOption[]
  drawings: LookupOption[]
  procurementItems: LookupOption[]
  onAddRow: (space: string) => void
  onFieldSave: (itemId: string, field: string, value: string | null) => void
  onDeleted: (id: string) => void
}

export function SpecTable({
  items,
  canManage,
  vendors,
  drawings,
  procurementItems,
  onAddRow,
  onFieldSave,
  onDeleted,
}: SpecTableProps) {
  const { toast } = useToast()
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set())

  function toggleSpace(space: string) {
    setCollapsedSpaces((prev) => {
      const next = new Set(prev)
      if (next.has(space)) next.delete(space)
      else next.add(space)
      return next
    })
  }

  async function handleDelete(id: string) {
    try {
      await deleteSpecItem(id)
      onDeleted(id)
      toast({ title: "Row deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  // Group by space — each row is independently editable (fixes Bug #28's
  // one-item-per-space limitation: a space can now hold any number of rows).
  const bySpace: Record<string, SpecItem[]> = {}
  for (const item of items) {
    if (!bySpace[item.space]) bySpace[item.space] = []
    bySpace[item.space].push(item)
  }

  const spaces = Object.keys(bySpace).sort()

  return (
    <div className="flex flex-col gap-4">
      {spaces.map((space) => {
        const collapsed = collapsedSpaces.has(space)
        const spaceItems = bySpace[space]
        return (
          <div key={space} className="border rounded-lg overflow-hidden">
            {/* Space header */}
            <div className="flex items-center justify-between bg-gray-100 text-gray-700 font-semibold px-3 py-2">
              <button
                className="flex items-center gap-1 flex-1 text-left"
                onClick={() => toggleSpace(space)}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {space}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({spaceItems.length} row{spaceItems.length !== 1 ? "s" : ""})
                </span>
              </button>
              {canManage && !collapsed && (
                <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => onAddRow(space)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add row
                </Button>
              )}
            </div>

            {!collapsed && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Surface</TableHead>
                    <TableHead className="min-w-[160px]">Material Name</TableHead>
                    <TableHead className="min-w-[120px]">Finish Type</TableHead>
                    <TableHead className="min-w-[160px]">Supplier</TableHead>
                    <TableHead className="min-w-[140px]">Dimensions</TableHead>
                    <TableHead className="min-w-[160px]">Location Notes</TableHead>
                    <TableHead className="min-w-[160px]">Drawing Reference</TableHead>
                    <TableHead className="min-w-[160px]">Linked Procurement Item</TableHead>
                    <TableHead className="w-10" />
                    {canManage && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spaceItems.map((item) => (
                    <SpecRow
                      key={item.id}
                      item={item}
                      canManage={canManage}
                      vendors={vendors}
                      drawings={drawings}
                      procurementItems={procurementItems}
                      onFieldSave={onFieldSave}
                      onDelete={handleDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SpecRow({
  item,
  canManage,
  vendors,
  drawings,
  procurementItems,
  onFieldSave,
  onDelete,
}: {
  item: SpecItem
  canManage: boolean
  vendors: LookupOption[]
  drawings: LookupOption[]
  procurementItems: LookupOption[]
  onFieldSave: (itemId: string, field: string, value: string | null) => void
  onDelete: (id: string) => void
}) {
  const [materialName, setMaterialName] = useState(item.material_name)
  const [finishType, setFinishType] = useState(item.finish_type ?? "")
  const [dimensions, setDimensions] = useState(item.dimensions ?? "")
  const [locationNotes, setLocationNotes] = useState(item.location_notes ?? "")

  useEffect(() => {
    setMaterialName(item.material_name)
    setFinishType(item.finish_type ?? "")
    setDimensions(item.dimensions ?? "")
    setLocationNotes(item.location_notes ?? "")
  }, [item.id, item.material_name, item.finish_type, item.dimensions, item.location_notes])

  const disabled = !canManage

  return (
    <TableRow>
      <TableCell>
        <Select
          value={item.surface}
          disabled={disabled}
          onValueChange={(v) => onFieldSave(item.id, "surface", v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SURFACES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Input
          className="h-8 text-xs"
          value={materialName}
          disabled={disabled}
          placeholder="e.g. Italian Marble"
          onChange={(e) => setMaterialName(e.target.value)}
          onBlur={() => materialName !== item.material_name && onFieldSave(item.id, "material_name", materialName)}
        />
      </TableCell>

      <TableCell>
        <Input
          className="h-8 text-xs"
          value={finishType}
          disabled={disabled}
          placeholder="e.g. Matt"
          onChange={(e) => setFinishType(e.target.value)}
          onBlur={() => finishType !== (item.finish_type ?? "") && onFieldSave(item.id, "finish_type", finishType || null)}
        />
      </TableCell>

      <TableCell>
        <Select
          value={item.supplier_vendor_id ?? NONE}
          disabled={disabled}
          onValueChange={(v) => onFieldSave(item.id, "supplier_vendor_id", v === NONE ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select vendor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!item.supplier_vendor_id && item.supplier && (
          <p className="text-[10px] text-muted-foreground mt-1">Legacy: {item.supplier}</p>
        )}
      </TableCell>

      <TableCell>
        <Input
          className="h-8 text-xs"
          value={dimensions}
          disabled={disabled}
          placeholder="e.g. 600×600mm"
          onChange={(e) => setDimensions(e.target.value)}
          onBlur={() => dimensions !== (item.dimensions ?? "") && onFieldSave(item.id, "dimensions", dimensions || null)}
        />
      </TableCell>

      <TableCell>
        <Input
          className="h-8 text-xs"
          value={locationNotes}
          disabled={disabled}
          placeholder="Notes…"
          onChange={(e) => setLocationNotes(e.target.value)}
          onBlur={() => locationNotes !== (item.location_notes ?? "") && onFieldSave(item.id, "location_notes", locationNotes || null)}
        />
      </TableCell>

      <TableCell>
        <Select
          value={item.drawing_reference_document_id ?? NONE}
          disabled={disabled}
          onValueChange={(v) => onFieldSave(item.id, "drawing_reference_document_id", v === NONE ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select drawing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {drawings.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!item.drawing_reference_document_id && item.drawing_reference && (
          <p className="text-[10px] text-muted-foreground mt-1">Legacy: {item.drawing_reference}</p>
        )}
      </TableCell>

      <TableCell>
        <Select
          value={item.linked_procurement_id ?? NONE}
          disabled={disabled}
          onValueChange={(v) => onFieldSave(item.id, "linked_procurement_id", v === NONE ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {procurementItems.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <RevisionHistoryButton
          revisions={item.revisions}
          vendors={vendors}
          drawings={drawings}
          procurementItems={procurementItems}
        />
      </TableCell>

      {canManage && (
        <TableCell>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

function RevisionHistoryButton({
  revisions,
  vendors,
  drawings,
  procurementItems,
}: {
  revisions: SpecRevision[]
  vendors: LookupOption[]
  drawings: LookupOption[]
  procurementItems: LookupOption[]
}) {
  if (!revisions || revisions.length === 0) {
    return <span className="inline-block w-7 h-7" />
  }

  function resolveValue(fieldName: string, raw: string): string {
    if (!raw) return "—"
    const lookup =
      fieldName === "supplier_vendor_id" ? vendors :
      fieldName === "drawing_reference_document_id" ? drawings :
      fieldName === "linked_procurement_id" ? procurementItems :
      null
    if (!lookup) return raw
    return lookup.find((o) => o.id === raw)?.name ?? raw
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Revision history">
          <History className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <p className="text-xs font-medium mb-2">
          Revision History ({revisions.length} change{revisions.length !== 1 ? "s" : ""})
        </p>
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
          {[...revisions].reverse().map((rev, idx) => (
            <div key={idx} className="border-l-2 border-gray-200 pl-2.5 text-xs">
              <p className="text-muted-foreground">
                {formatDistanceToNow(new Date(rev.changed_at), { addSuffix: true })} · changed{" "}
                <strong>{FIELD_LABELS[rev.field_name] ?? rev.field_name}</strong>
              </p>
              <p className="mt-0.5">
                <span className="line-through text-red-400">{resolveValue(rev.field_name, rev.old_value)}</span>
                {" → "}
                <span className="text-green-700 font-medium">{resolveValue(rev.field_name, rev.new_value)}</span>
              </p>
              {rev.reason && <p className="text-muted-foreground italic mt-0.5">Reason: {rev.reason}</p>}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
