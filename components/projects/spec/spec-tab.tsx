"use client"

import { useState, useEffect } from "react"
import { FileText, Upload, ExternalLink, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { useToast } from "@/hooks/use-toast"
import {
  importFromProcurement,
  getProcurementSchedulesForProject,
  getDrawingDocumentsForProject,
  getProcurementItemsForProject,
  createSpecItem,
  updateSpecItem,
  type SpecItem,
} from "@/app/actions/spec"
import { getVendors } from "@/app/actions/vendors"
import { SpecTable } from "./spec-table"

interface SpecTabProps {
  project: { id: string; studio_id: string; name: string }
  initialItems: SpecItem[]
  currentUser: { id: string; role: string }
}

export function SpecTab({ project, initialItems, currentUser }: SpecTabProps) {
  const { toast } = useToast()
  const role = currentUser.role as StudioRole
  const canManage = hasPermission(role, "manage_spec")

  const [items, setItems] = useState<SpecItem[]>(initialItems)
  const [spaceFilter, setSpaceFilter] = useState("all")
  const [importing, setImporting] = useState(false)
  const [scheduleId, setScheduleId] = useState("")
  const [schedules, setSchedules] = useState<Array<{ id: string; name: string }>>([])
  const [schedulesLoaded, setSchedulesLoaded] = useState(false)
  const [showImportSelect, setShowImportSelect] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [addingSpace, setAddingSpace] = useState(false)

  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([])
  const [drawings, setDrawings] = useState<Array<{ id: string; name: string }>>([])
  const [procurementItems, setProcurementItems] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    Promise.all([
      getVendors().catch(() => []),
      getDrawingDocumentsForProject(project.id).catch(() => []),
      getProcurementItemsForProject(project.id).catch(() => []),
    ]).then(([v, d, p]) => {
      setVendors(v.map((x) => ({ id: x.id, name: x.name })))
      setDrawings(d)
      setProcurementItems(p)
    })
  }, [project.id])

  const allSpaces = [...new Set(items.map((i) => i.space))].sort()

  const filteredItems = spaceFilter === "all"
    ? items
    : items.filter((i) => i.space === spaceFilter)

  function handleSaved(item: SpecItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleAddRow(space: string) {
    try {
      const item = await createSpecItem({ projectId: project.id, space, surface: "floor" })
      handleSaved(item)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleAddSpace() {
    const space = newSpaceName.trim()
    if (!space) return
    setAddingSpace(true)
    try {
      await handleAddRow(space)
      setNewSpaceName("")
    } finally {
      setAddingSpace(false)
    }
  }

  async function handleFieldSave(itemId: string, field: string, value: string | null) {
    // Optimistic update so the cell reflects the edit immediately.
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
    try {
      const updated = await updateSpecItem(itemId, { [field]: value } as Partial<SpecItem>)
      handleSaved(updated)
    } catch (err) {
      const original = items.find((i) => i.id === itemId)
      if (original) handleSaved(original)
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function openImport() {
    if (!schedulesLoaded) {
      try {
        const data = await getProcurementSchedulesForProject(project.id)
        setSchedules(data)
        setSchedulesLoaded(true)
      } catch {
        setSchedules([])
      }
    }
    setShowImportSelect(true)
  }

  async function handleImport() {
    if (!scheduleId) return
    setImporting(true)
    try {
      const { imported, skippedCount } = await importFromProcurement(project.id, scheduleId)
      setItems((prev) => [...prev, ...imported])
      const parts = [`${imported.length} item${imported.length !== 1 ? "s" : ""} imported.`]
      if (skippedCount > 0) {
        parts.push(`${skippedCount} already imported — skipped.`)
      }
      toast({ title: parts.join(" ") })
      setShowImportSelect(false)
      setScheduleId("")
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <>
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-9 w-40 text-sm"
                  placeholder="New space name…"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSpace()}
                />
                <Button
                  className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
                  onClick={handleAddSpace}
                  disabled={!newSpaceName.trim() || addingSpace}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Space
                </Button>
              </div>
              <Button variant="outline" onClick={openImport}>
                <Upload className="w-4 h-4 mr-1" /> Import from Procurement
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => window.open(`/api/spec/pdf?projectId=${project.id}`, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-1" /> Export PDF
          </Button>
        </div>

        {/* Space filter pills */}
        {allSpaces.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSpaceFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${spaceFilter === "all" ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              All
            </button>
            {allSpaces.map((space) => (
              <button
                key={space}
                onClick={() => setSpaceFilter(space)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${spaceFilter === space ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
              >
                {space}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import select */}
      {showImportSelect && (
        <div className="border rounded-lg p-4 bg-amber-50/60 flex items-end gap-3 flex-wrap">
          {schedules.length === 0 ? (
            <p className="text-sm text-amber-700">No procurement schedules found for this project.</p>
          ) : (
            <>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium mb-1.5">Choose a procurement schedule</p>
                <Select value={scheduleId} onValueChange={setScheduleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={!scheduleId || importing} onClick={handleImport}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setShowImportSelect(false)}>Cancel</Button>
        </div>
      )}

      {/* Table or empty state */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl text-center">
          <FileText className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No specification items yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a space above, or import from a procurement schedule.
          </p>
        </div>
      ) : (
        <SpecTable
          items={filteredItems}
          canManage={canManage}
          vendors={vendors}
          drawings={drawings}
          procurementItems={procurementItems}
          onAddRow={handleAddRow}
          onFieldSave={handleFieldSave}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
