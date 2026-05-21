"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PortfolioProject } from "@/app/actions/portfolio"

const STATUS_COLORS: Record<string, string> = {
  active:    "#1e3a5f",
  on_hold:   "#78350f",
  completed: "#134e3a",
  archived:  "#64748b",
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-slate-100 text-slate-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-50 text-amber-800" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-800" },
  archived:  { label: "Archived",  className: "bg-slate-100 text-slate-500" },
}

// All colours hard-coded to light values — the Gantt sits on a white card
// and must never inherit dark-mode CSS variables from the parent theme.
const GANTT_STYLES = `
  .portfolio-gantt .gantt_container {
    font-family: Inter, Arial, sans-serif !important;
    border: 1px solid #e8edf2 !important;
    border-radius: 0.5rem !important;
    overflow: hidden !important;
    background: #ffffff !important;
    color: #334155 !important;
  }
  .portfolio-gantt .gantt_grid_scale,
  .portfolio-gantt .gantt_task_scale {
    background: #f6f8fa !important;
    border-bottom: 1px solid #e8edf2 !important;
    color: #94a3b8 !important;
  }
  .portfolio-gantt .gantt_grid_head_cell,
  .portfolio-gantt .gantt_scale_cell {
    color: #94a3b8 !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.06em !important;
  }
  .portfolio-gantt .gantt_grid_data,
  .portfolio-gantt .gantt_task_bg {
    background: #ffffff !important;
  }
  .portfolio-gantt .gantt_row,
  .portfolio-gantt .gantt_row.odd {
    background: #ffffff !important;
    border-bottom: 1px solid #f1f5f9 !important;
  }
  .portfolio-gantt .gantt_row:hover,
  .portfolio-gantt .gantt_row.odd:hover {
    background: #fafbfc !important;
  }
  .portfolio-gantt .gantt_cell {
    font-size: 13px !important;
    color: #334155 !important;
    border-right-color: #f1f5f9 !important;
  }
  .portfolio-gantt .gantt_grid_column_resize_wrap {
    background: #e8edf2 !important;
  }
  .portfolio-gantt .gantt_task_line {
    border-radius: 3px !important;
  }
  .portfolio-gantt .gantt_task_content {
    color: rgba(255,255,255,0.92) !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    letter-spacing: 0.01em !important;
  }
  .portfolio-gantt .gantt_today_marker {
    background: #e94560 !important;
    opacity: 0.35 !important;
    width: 1px !important;
  }
  .portfolio-gantt .gantt_task_progress {
    border-radius: 3px 0 0 3px !important;
    opacity: 0.25 !important;
  }
`

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
        ganttInstance.config.bar_height = 26
        ganttInstance.config.scale_height = 46
        ganttInstance.config.fit_tasks = true
        ganttInstance.config.drag_links = false
        ganttInstance.config.drag_move = false
        ganttInstance.config.drag_resize = false
        ganttInstance.config.drag_progress = false
        ganttInstance.config.open_tree_initially = true
        ganttInstance.config.show_today_marker = true
        ganttInstance.config.readonly = true

        ganttInstance.config.columns = [
          { name: "text",       label: "Project", tree: false, width: 180, resize: true },
          { name: "client",     label: "Client",              width: 120,  resize: true },
          { name: "start_date", label: "Start",  align: "center", width: 90 },
          { name: "end_date",   label: "End",    align: "center", width: 90 },
        ]

        ganttInstance.config.scales = [
          { unit: "month", step: 1, format: "%F %Y" },
        ]

        const barStyleId = "portfolio-gantt-bar-styles"
        if (!document.getElementById(barStyleId)) {
          const barStyle = document.createElement("style")
          barStyle.id = barStyleId
          barStyle.textContent = Object.entries(STATUS_COLORS)
            .map(([status, color]) =>
              `.portfolio-gantt-bar-${status},
               .portfolio-gantt-bar-${status} .gantt_task_progress {
                 background: ${color} !important;
                 border-color: ${color} !important;
               }`
            )
            .join("\n")
          document.head.appendChild(barStyle)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ganttInstance.templates.task_class = (_start: any, _end: any, task: any) =>
          `portfolio-gantt-bar-${task.status ?? "active"}`

        ganttInstance.clearAll()

        const today = new Date().toISOString().split("T")[0]
        const tasks = filteredProjects
          .map((p, idx) => {
            const start = p.portfolio_year_completed
              ? `${p.portfolio_year_completed}-01-01`
              : today
            // DHTMLX end_date is exclusive — use Jan 1 of next year for full-year bar
            const end = p.portfolio_year_completed
              ? `${p.portfolio_year_completed + 1}-01-01`
              : today
            return {
              id: idx + 1,
              text: p.name,
              client: p.client_name,
              start_date: start,
              end_date: end,
              duration: 1,
              status: p.status,
              progress: p.status === "completed" || p.status === "archived" ? 1 : 0.5,
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
      <div className="flex items-center gap-3 flex-wrap">
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

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5">
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
                    <p className="text-xs text-muted-foreground mt-0.5">{start} → {end}</p>
                  )}
                </div>
                <Badge className={`text-xs border-0 shrink-0 ${statusMeta.className}`}>
                  {statusMeta.label}
                </Badge>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="portfolio-gantt rounded-lg overflow-hidden bg-white shadow-sm">
          <div ref={containerRef} style={{ width: "100%", height: 400 }} />
        </div>
      )}
    </div>
  )
}
