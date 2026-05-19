"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PortfolioProject } from "@/app/actions/portfolio"

const STATUS_COLORS: Record<string, string> = {
  active:    "#1a1a2e",
  on_hold:   "#f59e0b",
  completed: "#10b981",
  archived:  "#6b7280",
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  className: "bg-gray-100 text-gray-500" },
}

const GANTT_STYLES = `
  .portfolio-gantt .gantt_container {
    font-family: Inter, Arial, sans-serif !important;
    border: 1px solid hsl(var(--border)) !important;
    border-radius: 0.5rem !important;
    overflow: hidden !important;
  }
  .portfolio-gantt .gantt_grid_scale,
  .portfolio-gantt .gantt_task_scale {
    background: hsl(var(--muted)) !important;
    border-bottom: 1px solid hsl(var(--border)) !important;
  }
  .portfolio-gantt .gantt_grid_head_cell {
    color: #94a3b8 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
  }
  .portfolio-gantt .gantt_row {
    border-bottom: 1px solid hsl(var(--border)) !important;
  }
  .portfolio-gantt .gantt_cell {
    font-size: 13px !important;
  }
`

interface PhaseItem { start_date?: string; end_date?: string }

function getProjectDates(phases: unknown): { start: string | null; end: string | null } {
  if (!Array.isArray(phases) || phases.length === 0) return { start: null, end: null }
  const typed = phases as PhaseItem[]
  const starts = typed.filter((p) => p.start_date).map((p) => p.start_date!)
  const ends = typed.filter((p) => p.end_date).map((p) => p.end_date!)
  if (!starts.length || !ends.length) return { start: null, end: null }
  return { start: starts.sort()[0], end: ends.sort().at(-1)! }
}

interface Props {
  projects: PortfolioProject[]
}

type FilterType = "all" | "active" | "completed"

export function CrossProjectTimeline({ projects }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filterStatus, setFilterStatus] = useState<FilterType>("all")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const filteredProjects = projects.filter((p) => {
    if (filterStatus === "active") return p.status === "active"
    if (filterStatus === "completed") return p.status === "completed"
    return true
  })

  useEffect(() => {
    if (isMobile || !containerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ganttInstance: any

    // Inject styles once
    const styleId = "portfolio-gantt-styles"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = GANTT_STYLES
      document.head.appendChild(style)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("dhtmlx-gantt/codebase/dhtmlxgantt.css" as any).catch(() => {})

    const timer = setTimeout(() => {
      import("dhtmlx-gantt").then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ganttInstance = (module as any).gantt ?? (module as any).default
        if (!ganttInstance || !containerRef.current) return

        ganttInstance.config.date_format = "%Y-%m-%d"
        ganttInstance.config.xml_date = "%Y-%m-%d"
        ganttInstance.config.row_height = 44
        ganttInstance.config.bar_height = 28
        ganttInstance.config.scale_height = 50
        ganttInstance.config.fit_tasks = true
        ganttInstance.config.drag_links = false
        ganttInstance.config.drag_move = false
        ganttInstance.config.drag_resize = false
        ganttInstance.config.drag_progress = false
        ganttInstance.config.open_tree_initially = true
        ganttInstance.config.show_today_marker = true
        ganttInstance.config.readonly = true

        ganttInstance.config.columns = [
          { name: "text", label: "Project", tree: false, width: 180, resize: true },
          { name: "client", label: "Client", width: 120, resize: true },
          { name: "start_date", label: "Start", align: "center", width: 90 },
          { name: "end_date", label: "End", align: "center", width: 90 },
        ]

        ganttInstance.config.scales = [
          { unit: "month", step: 1, format: "%F %Y" },
        ]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ganttInstance.templates.task_class = (_start: any, _end: any, task: any) => {
          return `portfolio-gantt-bar-${task.status ?? "active"}`
        }

        // Inject bar colour styles
        const barStyleId = "portfolio-gantt-bar-styles"
        if (!document.getElementById(barStyleId)) {
          const barStyle = document.createElement("style")
          barStyle.id = barStyleId
          barStyle.textContent = Object.entries(STATUS_COLORS)
            .map(([status, color]) => `.portfolio-gantt-bar-${status} .gantt_task_progress, .portfolio-gantt-bar-${status} { background:${color} !important; border-color:${color} !important; }`)
            .join("\n")
          document.head.appendChild(barStyle)
        }

        ganttInstance.clearAll()

        const today = new Date().toISOString().split("T")[0]
        const tasks = filteredProjects
          .map((p, idx) => {
            const start = p.portfolio_year_completed
              ? `${p.portfolio_year_completed}-01-01`
              : today
            const end = p.portfolio_year_completed
              ? `${p.portfolio_year_completed}-12-31`
              : today
            return {
              id: idx + 1,
              text: p.name,
              client: p.client_name,
              start_date: start,
              end_date: end,
              duration: 1,
              status: p.status,
              progress: p.status === "completed" ? 1 : p.status === "archived" ? 1 : 0.5,
            }
          })
          .filter((t) => t.start_date && t.end_date)

        ganttInstance.parse({ data: tasks, links: [] })
        ganttInstance.init(containerRef.current)
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (ganttInstance) {
        try { ganttInstance.clearAll() } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProjects.map((p) => p.id).join(","), isMobile])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="completed">Completed Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Colour key */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="capitalize">{status.replace("_", " ")}</span>
            </span>
          ))}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex items-center justify-center h-40 border border-dashed rounded-xl text-muted-foreground text-sm">
          No projects found for the selected filter.
        </div>
      ) : isMobile ? (
        /* Mobile: card list */
        <div className="flex flex-col gap-3">
          {filteredProjects.map((p) => {
            const statusMeta = STATUS_BADGE[p.status] ?? STATUS_BADGE.active
            const start = p.portfolio_year_completed ? `${p.portfolio_year_completed}-01-01` : null
            const end = p.portfolio_year_completed ? `${p.portfolio_year_completed}-12-31` : null
            return (
              <div key={p.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client_name}</p>
                  {(start || end) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {start} → {end}
                    </p>
                  )}
                </div>
                <Badge className={`text-xs border-0 shrink-0 ${statusMeta.className}`}>{statusMeta.label}</Badge>
              </div>
            )
          })}
        </div>
      ) : (
        /* Desktop: DHTMLX Gantt */
        <div className="portfolio-gantt">
          <div ref={containerRef} style={{ width: "100%", height: 400 }} />
        </div>
      )}
    </div>
  )
}
