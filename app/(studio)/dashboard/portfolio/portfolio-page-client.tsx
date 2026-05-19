"use client"

import { useState, useMemo } from "react"
import { LayoutGrid, List, MoreVertical, Image as ImageIcon, Download, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { PortfolioProject } from "@/app/actions/portfolio"
import { PortfolioDetailPanel } from "./portfolio-detail-panel"
import { ExportOptionsSheet } from "./export-options-sheet"
import { CrossProjectTimeline } from "./cross-project-timeline"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  hospitality: "Hospitality",
  retail: "Retail",
  other: "Other",
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  className: "bg-gray-100 text-gray-500" },
}

interface Props {
  portfolioProjects: PortfolioProject[]
  currentUserRole: string
}

export function PortfolioPageClient({ portfolioProjects, currentUserRole }: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [typeFilter, setTypeFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<PortfolioProject | null>(null)
  const [panelDefaultTab, setPanelDefaultTab] = useState<"details" | "gallery">("details")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPreSelected, setExportPreSelected] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [localProjects, setLocalProjects] = useState(portfolioProjects)

  const canExport = currentUserRole === "owner" || currentUserRole === "senior_designer"

  const types = useMemo(() => [...new Set(localProjects.map((p) => p.type))], [localProjects])
  const years = useMemo(() => [
    ...new Set(localProjects.map((p) => p.portfolio_year_completed).filter(Boolean) as number[]),
  ].sort((a, b) => b - a), [localProjects])

  const filtered = useMemo(() => {
    return localProjects.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false
      if (yearFilter !== "all" && String(p.portfolio_year_completed) !== yearFilter) return false
      if (publishedOnly && !p.portfolio_published) return false
      return true
    })
  }, [localProjects, typeFilter, yearFilter, publishedOnly])

  function openPanel(project: PortfolioProject, tab: "details" | "gallery" = "details") {
    setSelectedPanel(project)
    setPanelDefaultTab(tab)
  }

  function handleExportSelected() {
    setExportPreSelected([...selectedIds])
    setExportOpen(true)
  }

  function handleExportAllPublished() {
    setExportPreSelected(localProjects.filter((p) => p.portfolio_published).map((p) => p.id))
    setExportOpen(true)
  }

  function handleExportThis(project: PortfolioProject) {
    setExportPreSelected([project.id])
    setExportOpen(true)
  }

  function handlePanelUpdate(updated: PortfolioProject) {
    setLocalProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p))
    setSelectedPanel(updated)
  }

  if (localProjects.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 h-64 border border-dashed rounded-xl text-muted-foreground">
          <ImageIcon className="w-10 h-10 opacity-30" />
          <p className="text-sm text-center max-w-xs">
            No completed projects yet. Mark a project as &quot;Completed&quot; or &quot;Archived&quot; to add it to your portfolio.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/projects")}>
            Go to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        </div>
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#e94560] hover:bg-[#c73652] text-white gap-1">
                <Download className="w-4 h-4" />
                Export PDF
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={selectedIds.size === 0}
                onClick={handleExportSelected}
              >
                Export Selected Projects
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAllPublished}>
                Export All Published
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Tabs defaultValue="gallery">
        <TabsList className="bg-transparent border-b rounded-none p-0 gap-0 h-auto w-full justify-start">
          {[
            { label: "Gallery", value: "gallery" },
            { label: "Timeline", value: "timeline" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#e94560] data-[state=active]:bg-transparent data-[state=active]:text-[#e94560] px-4 pb-2 shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="gallery" className="mt-4">
          {/* Filter row */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="published-only"
                checked={publishedOnly}
                onCheckedChange={setPublishedOnly}
              />
              <Label htmlFor="published-only" className="text-sm cursor-pointer">Published Only</Label>
            </div>

            <div className="ml-auto flex items-center border rounded-md overflow-hidden">
              <button
                className={`p-2 ${viewMode === "grid" ? "bg-[#1a1a2e] text-white" : "text-muted-foreground hover:bg-accent"}`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                className={`p-2 ${viewMode === "list" ? "bg-[#1a1a2e] text-white" : "text-muted-foreground hover:bg-accent"}`}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 border border-dashed rounded-xl text-muted-foreground text-sm">
              No projects match the current filters.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((project) => (
                <PortfolioCard
                  key={project.id}
                  project={project}
                  isSelected={selectedIds.has(project.id)}
                  onSelect={(id) => setSelectedIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id); else next.add(id)
                    return next
                  })}
                  onOpen={() => openPanel(project, "details")}
                  onGallery={() => openPanel(project, "gallery")}
                  onExport={() => handleExportThis(project)}
                  canExport={canExport}
                />
              ))}
            </div>
          ) : (
            <PortfolioListView
              projects={filtered}
              selectedIds={selectedIds}
              onSelect={(id) => setSelectedIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })}
              onOpen={(p) => openPanel(p, "details")}
              onGallery={(p) => openPanel(p, "gallery")}
              onExport={handleExportThis}
              canExport={canExport}
            />
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <CrossProjectTimeline projects={localProjects} />
        </TabsContent>
      </Tabs>

      {selectedPanel && (
        <PortfolioDetailPanel
          project={selectedPanel}
          defaultTab={panelDefaultTab}
          open={!!selectedPanel}
          onClose={() => setSelectedPanel(null)}
          onUpdate={handlePanelUpdate}
          currentUserRole={currentUserRole}
        />
      )}

      <ExportOptionsSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        allProjects={localProjects}
        preSelectedIds={exportPreSelected}
        studioName=""
      />
    </div>
  )
}

function PortfolioCard({
  project,
  isSelected,
  onSelect,
  onOpen,
  onGallery,
  onExport,
  canExport,
}: {
  project: PortfolioProject
  isSelected: boolean
  onSelect: (id: string) => void
  onOpen: () => void
  onGallery: () => void
  onExport: () => void
  canExport: boolean
}) {
  return (
    <div
      className={`group rounded-xl border bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-[#e94560]" : ""}`}
    >
      {/* Cover */}
      <div
        className="relative aspect-video bg-gray-100 overflow-hidden"
        onClick={onOpen}
      >
        {project.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : project.gallery_items[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.gallery_items[0].image_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LayoutGrid className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {/* Selection checkbox */}
        <div className="absolute top-2 left-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(project.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded cursor-pointer accent-[#e94560]"
          />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0" onClick={onOpen}>
            <p className="font-semibold text-[#1a1a2e] truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.client_name}
              {project.client_name && " · "}
              {TYPE_LABELS[project.type] ?? project.type}
              {project.portfolio_year_completed && ` · ${project.portfolio_year_completed}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpen}>Edit Portfolio Details</DropdownMenuItem>
              <DropdownMenuItem onClick={onGallery}>Manage Gallery</DropdownMenuItem>
              {canExport && (
                <DropdownMenuItem onClick={onExport}>Export This Project</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {project.gallery_count} photo{project.gallery_count !== 1 ? "s" : ""}
          </span>
          {project.portfolio_published ? (
            <Badge className="text-xs bg-green-100 text-green-800 border-0">Published</Badge>
          ) : (
            <Badge className="text-xs bg-slate-100 text-slate-600 border-0">Draft</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function PortfolioListView({
  projects,
  selectedIds,
  onSelect,
  onOpen,
  onGallery,
  onExport,
  canExport,
}: {
  projects: PortfolioProject[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onOpen: (p: PortfolioProject) => void
  onGallery: (p: PortfolioProject) => void
  onExport: (p: PortfolioProject) => void
  canExport: boolean
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="w-8 p-3"></th>
            <th className="text-left p-3 font-medium">Project</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Client</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Type</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Year</th>
            <th className="text-left p-3 font-medium">Photos</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="w-10 p-3"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onSelect(p.id)}
                  className="w-4 h-4 rounded accent-[#e94560]"
                />
              </td>
              <td className="p-3">
                <button className="font-medium hover:text-[#e94560] transition-colors text-left" onClick={() => onOpen(p)}>
                  {p.name}
                </button>
              </td>
              <td className="p-3 text-muted-foreground hidden md:table-cell">{p.client_name}</td>
              <td className="p-3 text-muted-foreground hidden lg:table-cell">{TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="p-3 text-muted-foreground hidden md:table-cell">{p.portfolio_year_completed ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{p.gallery_count}</td>
              <td className="p-3">
                {p.portfolio_published ? (
                  <Badge className="text-xs bg-green-100 text-green-800 border-0">Published</Badge>
                ) : (
                  <Badge className="text-xs bg-slate-100 text-slate-600 border-0">Draft</Badge>
                )}
              </td>
              <td className="p-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpen(p)}>Edit Portfolio Details</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onGallery(p)}>Manage Gallery</DropdownMenuItem>
                    {canExport && (
                      <DropdownMenuItem onClick={() => onExport(p)}>Export This Project</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
