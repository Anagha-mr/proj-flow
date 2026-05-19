"use client"

import { useState, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { PortfolioProject, PortfolioExportOptions } from "@/app/actions/portfolio"

interface Props {
  open: boolean
  onClose: () => void
  allProjects: PortfolioProject[]
  preSelectedIds: string[]
  studioName: string
}

function ToggleOption<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border transition-colors",
            value === opt.value
              ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
              : "bg-background text-muted-foreground border-border hover:bg-accent"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function ExportOptionsSheet({ open, onClose, allProjects, preSelectedIds, studioName }: Props) {
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds))
  const [pageSize, setPageSize] = useState<"A4" | "A3">("A4")
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape")
  const [includeTeam, setIncludeTeam] = useState(true)
  const [includeScope, setIncludeScope] = useState(true)
  const [includeLocation, setIncludeLocation] = useState(true)
  const [generating, setGenerating] = useState(false)

  useMemo(() => {
    setSelectedIds(new Set(preSelectedIds))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedIds.join(",")])

  const eligibleProjects = allProjects.filter((p) => p.portfolio_published || p.gallery_count > 0)
  const displayProjects = eligibleProjects.length > 0 ? eligibleProjects : allProjects

  const selectedProjects = displayProjects.filter((p) => selectedIds.has(p.id))
  const totalPhotos = selectedProjects.reduce((s, p) => s + p.gallery_count, 0)
  const estimatedPages = selectedProjects.reduce((s, p) => s + 2 + Math.ceil(p.gallery_count / 2), 0) + Math.max(0, selectedProjects.length - 1) + 1

  const dateStr = new Date().toISOString().split("T")[0]
  const filename = `${studioName || "Studio"}_Portfolio_${dateStr}.pdf`

  function toggleAll(check: boolean) {
    if (check) setSelectedIds(new Set(displayProjects.map((p) => p.id)))
    else setSelectedIds(new Set())
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleExport() {
    if (selectedIds.size === 0) {
      toast({ title: "Select at least one project", variant: "destructive" })
      return
    }
    setGenerating(true)
    try {
      const options: PortfolioExportOptions = {
        project_ids: [...selectedIds],
        page_size: pageSize,
        orientation,
        include_team_members: includeTeam,
        include_scope_summary: includeScope,
        include_project_location: includeLocation,
      }
      const res = await fetch("/api/portfolio/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      })
      if (!res.ok) throw new Error("PDF generation failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Portfolio PDF ready — downloading now." })
      onClose()
    } catch {
      toast({ title: "Failed to generate PDF. Please try again.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const allChecked = displayProjects.length > 0 && selectedIds.size === displayProjects.length

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>Export Portfolio PDF</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-6 py-4">
          {/* Project checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Projects to Include</p>
              <button
                className="text-xs text-[#e94560] hover:underline"
                onClick={() => toggleAll(!allChecked)}
              >
                {allChecked ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {displayProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id={`proj-${p.id}`}
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                  />
                  <Label htmlFor={`proj-${p.id}`} className="flex-1 cursor-pointer flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      {p.portfolio_year_completed && `${p.portfolio_year_completed} · `}
                      <ImageIcon className="w-3 h-3 inline" />
                      {p.gallery_count}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Page size */}
          <div>
            <p className="text-sm font-medium mb-3">Page Size</p>
            <ToggleOption<"A4" | "A3">
              options={[{ label: "A4", value: "A4" }, { label: "A3", value: "A3" }]}
              value={pageSize}
              onChange={setPageSize}
            />
          </div>

          {/* Orientation */}
          <div>
            <p className="text-sm font-medium mb-3">Orientation</p>
            <ToggleOption<"landscape" | "portrait">
              options={[{ label: "Landscape", value: "landscape" }, { label: "Portrait", value: "portrait" }]}
              value={orientation}
              onChange={setOrientation}
            />
          </div>

          {/* Include toggles */}
          <div>
            <p className="text-sm font-medium mb-3">Include in Export</p>
            <div className="flex flex-col gap-3">
              {[
                { id: "include-team", label: "Team member names", checked: includeTeam, onChange: setIncludeTeam },
                { id: "include-scope", label: "Scope summary", checked: includeScope, onChange: setIncludeScope },
                { id: "include-location", label: "Project location (city)", checked: includeLocation, onChange: setIncludeLocation },
              ].map(({ id, label, checked, onChange }) => (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
                  <Label htmlFor={id} className="cursor-pointer text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedIds.size > 0 && (
            <div className="rounded-lg bg-muted/40 border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">~{estimatedPages} pages estimated</p>
              <p>{selectedIds.size} project{selectedIds.size !== 1 ? "s" : ""} · {totalPhotos} photo{totalPhotos !== 1 ? "s" : ""}</p>
              <p className="mt-2 text-xs truncate font-mono">{filename}</p>
            </div>
          )}
        </div>

        <SheetFooter className="border-t pt-4 flex flex-col gap-2">
          <Button
            onClick={handleExport}
            disabled={generating || selectedIds.size === 0}
            className="w-full bg-[#e94560] hover:bg-[#c73652] text-white"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Generating PDF…
              </>
            ) : "Export PDF"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={generating} className="w-full">
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
