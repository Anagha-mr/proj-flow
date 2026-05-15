"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { deleteSpecItem, type SpecItem } from "@/app/actions/spec"

const SURFACE_ORDER = ["floor", "wall", "ceiling", "joinery", "other"] as const
const SURFACE_LABEL: Record<string, string> = {
  floor: "Floor", wall: "Wall", ceiling: "Ceiling", joinery: "Joinery", other: "Other",
}

interface SpecTableProps {
  items: SpecItem[]
  canManage: boolean
  onEdit: (item: SpecItem) => void
  onAddToSpace: (space: string) => void
  onDeleted: (id: string) => void
}

export function SpecTable({ items, canManage, onEdit, onAddToSpace, onDeleted }: SpecTableProps) {
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
      toast({ title: "Item deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  // Group by space → surface
  const bySpace: Record<string, Record<string, SpecItem[]>> = {}
  for (const item of items) {
    if (!bySpace[item.space]) bySpace[item.space] = {}
    if (!bySpace[item.space][item.surface]) bySpace[item.space][item.surface] = []
    bySpace[item.space][item.surface].push(item)
  }

  const spaces = Object.keys(bySpace).sort()

  return (
    <div className="flex flex-col gap-2">
      {spaces.map((space) => {
        const collapsed = collapsedSpaces.has(space)
        const spaceItems = Object.values(bySpace[space]).flat()
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
                <span className="ml-2 text-xs font-normal text-gray-500">({spaceItems.length} item{spaceItems.length !== 1 ? "s" : ""})</span>
              </button>
              {canManage && !collapsed && (
                <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => onAddToSpace(space)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add to this space
                </Button>
              )}
            </div>

            {!collapsed && (
              <div>
                {SURFACE_ORDER.filter((s) => bySpace[space][s]?.length > 0).map((surface) => (
                  <div key={surface}>
                    <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                      {SURFACE_LABEL[surface]}
                    </div>
                    {bySpace[space][surface].map((item, i) => {
                      const revCount = item.revisions?.length ?? 0
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 pl-8 pr-4 py-3 border-b last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-indigo-50/40 cursor-pointer transition-colors group`}
                          onClick={() => onEdit(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.material_name}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {item.finish_type && <span className="text-xs text-gray-500">{item.finish_type}</span>}
                              {item.supplier && <span className="text-xs text-gray-400">· {item.supplier}</span>}
                              {item.dimensions && <span className="text-xs text-gray-400">· {item.dimensions}</span>}
                              {revCount > 0 && (
                                <span className="text-xs text-gray-400 italic">
                                  · Revised {revCount} time{revCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); onEdit(item) }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
