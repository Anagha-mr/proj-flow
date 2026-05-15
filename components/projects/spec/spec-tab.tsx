"use client"

import { useState } from "react"
import { FileText, Upload, ExternalLink, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { useToast } from "@/hooks/use-toast"
import { importFromProcurement, getProcurementSchedulesForProject, type SpecItem } from "@/app/actions/spec"
import { SpecTable } from "./spec-table"
import { SpecItemSheet } from "./spec-item-sheet"

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
  const [editItem, setEditItem] = useState<SpecItem | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [defaultSpace, setDefaultSpace] = useState("")
  const [importing, setImporting] = useState(false)
  const [scheduleId, setScheduleId] = useState("")
  const [schedules, setSchedules] = useState<Array<{ id: string; name: string }>>([])
  const [schedulesLoaded, setSchedulesLoaded] = useState(false)
  const [showImportSelect, setShowImportSelect] = useState(false)

  const allSpaces = [...new Set(items.map((i) => i.space))].sort()

  const filteredItems = spaceFilter === "all"
    ? items
    : items.filter((i) => i.space === spaceFilter)

  function handleEdit(item: SpecItem) {
    setEditItem(item)
    setDefaultSpace("")
    setShowSheet(true)
  }

  function handleAddToSpace(space: string) {
    setEditItem(null)
    setDefaultSpace(space)
    setShowSheet(true)
  }

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
      const newItems = await importFromProcurement(project.id, scheduleId)
      setItems((prev) => [...prev, ...newItems])
      toast({ title: `${newItems.length} item${newItems.length !== 1 ? "s" : ""} imported.` })
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
              <Button
                className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
                onClick={() => { setEditItem(null); setDefaultSpace(""); setShowSheet(true) }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Spec Item
              </Button>
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
            Add items manually or import from a procurement schedule.
          </p>
        </div>
      ) : (
        <SpecTable
          items={filteredItems}
          canManage={canManage}
          onEdit={handleEdit}
          onAddToSpace={handleAddToSpace}
          onDeleted={handleDeleted}
        />
      )}

      <SpecItemSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        projectId={project.id}
        existingSpaces={allSpaces}
        editItem={editItem}
        defaultSpace={defaultSpace}
        onSaved={handleSaved}
      />
    </div>
  )
}
