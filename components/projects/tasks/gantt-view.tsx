"use client"

import { useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { updateTask, addTaskDependency, removeTaskDependency } from "@/app/actions/tasks"
import type { TaskWithDetails } from "@/app/actions/tasks"

interface GanttViewProps {
  tasks: TaskWithDetails[]
  projectPhases: Array<{ id: string; name: string; color: string; start_date?: string; end_date?: string }>
  dependencies: Array<{ task_id: string; depends_on_task_id: string }>
  onTaskClick: (task: TaskWithDetails) => void
  onStatusChange: (taskId: string, newStatus: string) => void
}

const GANTT_STYLES = `
  /* Base */
  .gantt_container {
    font-family: Inter, sans-serif !important;
    border: 1px solid hsl(var(--border)) !important;
    border-radius: 0.5rem !important;
    overflow: hidden !important;
    background: hsl(var(--background)) !important;
  }
  /* Grid left panel */
  .gantt_grid {
    background: hsl(var(--card)) !important;
  }
  .gantt_grid_scale {
    background: hsl(var(--muted)) !important;
    border-bottom: 1px solid hsl(var(--border)) !important;
  }
  .gantt_grid_head_cell {
    color: #94a3b8 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    border-right: 1px solid hsl(var(--border)) !important;
  }
  .gantt_row {
    background: #0f1729 !important;
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
  }
  .gantt_row.odd {
    background: #111827 !important;
  }
  .gantt_row:hover, .gantt_row.odd:hover {
    background: #1e2d4a !important;
  }
  .gantt_cell {
    color: #e2e8f0 !important;
    font-size: 13px !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
  }
  /* Timeline right panel */
  .gantt_task {
    background: hsl(var(--background)) !important;
  }
  .gantt_task_scale {
    background: #0d1524 !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
  }
  .gantt_scale_cell {
    color: #94a3b8 !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    border-right: 1px solid rgba(255,255,255,0.06) !important;
  }
  .gantt_task_row {
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
    background: #0f1729 !important;
  }
  .gantt_task_row.odd {
    background: #111827 !important;
  }
  /* Task bars — shape only; colour comes from priority class */
  .gantt_task_line {
    border-radius: 6px !important;
    height: 28px !important;
    margin-top: 5px !important;
  }
  .gantt_task_line .gantt_task_content {
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.4) !important;
    border-radius: 6px !important;
    padding: 0 8px !important;
  }
  /* Priority colours - full bar */
  .gantt-urgent.gantt_task_line  { background: #e94560 !important; border-color: #c73652 !important; }
  .gantt-high.gantt_task_line    { background: #f97316 !important; border-color: #ea6c0a !important; }
  .gantt-medium.gantt_task_line  { background: #f59e0b !important; border-color: #d97706 !important; }
  .gantt-low.gantt_task_line     { background: #10b981 !important; border-color: #059669 !important; }
  .gantt-default.gantt_task_line { background: #6366f1 !important; border-color: #4f46e5 !important; }
  /* Progress bar inside task */
  .gantt_task_progress {
    background: rgba(0,0,0,0.2) !important;
    border-radius: 6px !important;
  }
  /* Done tasks - strikethrough in grid */
  .gantt-row-done .gantt_cell {
    text-decoration: line-through !important;
    color: #4b5563 !important;
  }
  /* Today marker */
  .gantt_today_marker {
    background: #e94560 !important;
    width: 2px !important;
    opacity: 0.8 !important;
  }
  /* Milestone diamond */
  .gantt_task_line.gantt_milestone {
    background: #1a1a2e !important;
    border-color: #e94560 !important;
  }
  /* Dependency arrows */
  .gantt_line_wrapper div { background: #94a3b8 !important; }
  .gantt_link_arrow { border-color: #94a3b8 !important; }
  /* Resize handle */
  .gantt_task_drag { background: rgba(255,255,255,0.3) !important; }
  /* Scrollbar */
  .gantt_layout_cell_border_right { border-color: hsl(var(--border)) !important; }
`

export function GanttView(props: GanttViewProps) {
  if (typeof window === "undefined") return null
  return <GanttViewInner {...props} />
}

function GanttViewInner({ tasks, projectPhases, dependencies, onTaskClick }: GanttViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  // Keep a stable ref so event handlers always see the latest tasks list
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  // Load DHTMLX base CSS + inject theme overrides once
  useEffect(() => {
    // Dynamic import so it only loads when the Gantt view is mounted,
    // keeping it off every other page in the app.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import("dhtmlx-gantt/codebase/dhtmlxgantt.css" as any).catch(() => {})

    const styleId = "gantt-custom-styles"
    if (document.getElementById(styleId)) return
    const style = document.createElement("style")
    style.id = styleId
    style.textContent = GANTT_STYLES
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ganttInstance: any

    const timer = setTimeout(() => {
      import("dhtmlx-gantt").then((module) => {
        ganttInstance = (module as any).gantt ?? (module as any).default

        // ── Configuration ──────────────────────────────────
        ganttInstance.config.date_format = "%Y-%m-%d"
        ganttInstance.config.xml_date = "%Y-%m-%d"
        ganttInstance.config.row_height = 44
        ganttInstance.config.bar_height = 28
        ganttInstance.config.scale_height = 50
        ganttInstance.config.fit_tasks = true
        ganttInstance.config.drag_links = true
        ganttInstance.config.drag_progress = false
        ganttInstance.config.open_tree_initially = true
        ganttInstance.config.show_today_marker = true

        ganttInstance.config.columns = [
          { name: "text", label: "Task", tree: true, width: 220, resize: true },
          { name: "start_date", label: "Start", align: "center", width: 90 },
          { name: "duration", label: "Days", align: "center", width: 50 },
          {
            name: "status",
            label: "Status",
            align: "center",
            width: 90,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            template: (task: any) => {
              const map: Record<string, string> = {
                todo: "To Do",
                in_progress: "In Progress",
                review: "Review",
                done: "Done",
              }
              return map[task.status] ?? task.status
            },
          },
        ]

        ganttInstance.config.scales = [
          { unit: "month", step: 1, format: "%F %Y" },
          { unit: "day",   step: 1, format: "%D %d" },
        ]

        // ── Templates ──────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ganttInstance.templates.task_class = (_start: any, _end: any, task: any) => {
          const map: Record<string, string> = {
            urgent: "gantt-urgent",
            high: "gantt-high",
            medium: "gantt-medium",
            low: "gantt-low",
          }
          return map[task.priority] ?? "gantt-default"
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ganttInstance.templates.grid_row_class = (_start: any, _end: any, task: any) => {
          if (task.status === "done") return "gantt-row-done"
          return ""
        }

        // ── Init + parse ───────────────────────────────────
        ganttInstance.init(containerRef.current)
        ganttInstance.parse(buildData(tasksRef.current, projectPhases, dependencies, ganttInstance))

        // ── Events ─────────────────────────────────────────
        ganttInstance.attachEvent("onTaskClick", (id: string) => {
          if (String(id).startsWith("phase_")) return true
          const task = tasksRef.current.find((t) => t.id === id)
          if (task) onTaskClick(task)
          return true
        })

        ganttInstance.attachEvent("onAfterTaskDrag", (id: string) => {
          if (String(id).startsWith("phase_")) return
          const ganttTask = ganttInstance.getTask(id)
          const startDate = ganttInstance.templates.format_date(ganttTask.start_date)
          const endDate = ganttInstance.templates.format_date(ganttTask.end_date)
          updateTask(id, { start_date: startDate, due_date: endDate }).catch(() =>
            toast({ title: "Failed to update task dates" })
          )
        })

        ganttInstance.attachEvent("onAfterLinkAdd", (id: string, link: { source: string; target: string }) => {
          addTaskDependency(link.source, link.target).catch((e: Error) => {
            toast({ title: e?.message ?? "Could not add dependency", variant: "destructive" })
            ganttInstance.deleteLink(id)
          })
        })

        ganttInstance.attachEvent("onAfterLinkDelete", (_id: string, link: { source: string; target: string }) => {
          removeTaskDependency(link.source, link.target).catch(() => {})
        })
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (ganttInstance) ganttInstance.clearAll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dependencies, projectPhases])

  return (
    <>
      {/* Mobile fallback */}
      <div className="flex items-center justify-center h-40 rounded-lg border text-sm text-muted-foreground sm:hidden">
        Timeline view is available on desktop
      </div>

      <div
        ref={containerRef}
        style={{ width: "100%", height: "600px" }}
        className="rounded-lg overflow-hidden border hidden sm:block"
      />
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function buildData(
  tasks: TaskWithDetails[],
  projectPhases: GanttViewProps["projectPhases"],
  dependencies: GanttViewProps["dependencies"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gantt: any
) {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split("T")[0]

  const ganttTasks = tasks.map((t, i) => {
    const start = t.start_date
      ? new Date(t.start_date)
      : new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000) // spread 1 week apart

    const end = t.due_date
      ? new Date(t.due_date)
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000) // default 2-week duration

    // DHTMLX end_date is exclusive — add 1 day so the bar fills the due date
    end.setDate(end.getDate() + 1)

    return {
      id: t.id,
      text: t.title,
      start_date: fmt(start),
      end_date: fmt(end),
      progress: (t.progress_percent ?? 0) / 100,
      status: t.status,
      priority: t.priority,
      phase: t.phase_tag ?? "Unassigned",
      open: true,
    }
  })

  const milestones = projectPhases
    .filter((p) => p.end_date)
    .map((p) => ({
      id: `phase_${p.id}`,
      text: p.name,
      start_date: p.end_date,
      duration: 0,
      type: gantt.config.types.milestone,
      readonly: true,
    }))

  const links = dependencies.map((d, i) => ({
    id: i + 1,
    source: d.task_id,
    target: d.depends_on_task_id,
    type: "0",
  }))

  return { data: [...ganttTasks, ...milestones], links }
}
