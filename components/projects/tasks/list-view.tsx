"use client"

import { useState, useRef } from "react"
import { format, isPast, differenceInDays } from "date-fns"
import { ChevronDown, ChevronRight, Plus, Paperclip } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { updateTask, getSubtasks } from "@/app/actions/tasks"
import type { TaskWithDetails } from "@/app/actions/tasks"

type PhaseItem = { id: string; name: string; color: string }
type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#e94560",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  todo: { label: "To Do", className: "bg-pink-50 text-[#e94560] border-[#e94560]/20" },
  in_progress: { label: "In Progress", className: "bg-blue-50 text-blue-600 border-blue-200" },
  review: { label: "Review", className: "bg-purple-50 text-purple-600 border-purple-200" },
  done: { label: "Done", className: "bg-green-50 text-green-600 border-green-200" },
}

function getGroupKey(task: TaskWithDetails, groupBy: string, studioUsers: StudioUser[]): string {
  switch (groupBy) {
    case "phase":
      return task.phase_tag ?? "No Phase"
    case "room":
      return task.room_tag ?? "No Room"
    case "priority":
      return task.priority
    case "status":
      return task.status
    case "assignee":
      return task.assignees[0]?.name ?? "Unassigned"
    default:
      return task.phase_tag ?? "No Phase"
  }
}

function getGroupColor(key: string, groupBy: string, projectPhases: PhaseItem[]): string {
  if (groupBy === "phase") {
    const phase = projectPhases.find((p) => p.name === key)
    return phase?.color ?? "#888"
  }
  if (groupBy === "priority") return PRIORITY_COLORS[key] ?? "#888"
  return "#888"
}

interface RowProps {
  task: TaskWithDetails
  projectPhases: PhaseItem[]
  onClick: () => void
  onStatusChange: (id: string, status: string) => void
  onTitleSave: (id: string, title: string) => void
  isSubtask?: boolean
  hasSubtasks?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}

function TaskRow({
  task,
  projectPhases,
  onClick,
  onStatusChange,
  onTitleSave,
  isSubtask,
  hasSubtasks,
  expanded,
  onToggleExpand,
}: RowProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const phase = projectPhases.find((p) => p.name === task.phase_tag)
  const statusMeta = STATUS_BADGE[task.status] ?? STATUS_BADGE.todo

  const dueDateColor =
    task.due_date
      ? isPast(new Date(task.due_date)) && task.status !== "done"
        ? "text-[#e94560]"
        : differenceInDays(new Date(task.due_date), new Date()) <= 3
        ? "text-amber-500"
        : "text-muted-foreground"
      : "text-muted-foreground"

  function handleTitleBlur() {
    setEditingTitle(false)
    if (title.trim() && title.trim() !== task.title) {
      onTitleSave(task.id, title.trim())
    }
  }

  return (
    <div
      className={`flex items-center gap-2 py-2 hover:bg-accent/30 rounded group border-b border-border/40 last:border-b-0 text-sm ${
        isSubtask ? "pl-9 pr-3 py-1.5 text-muted-foreground" : "px-3"
      }`}
    >
      {/* Expand/collapse toggle (parent rows with subtasks only) */}
      {!isSubtask && (
        <div className="w-4 shrink-0 flex items-center justify-center">
          {hasSubtasks && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.()
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Checkbox */}
      <Checkbox
        checked={task.status === "done"}
        disabled={isSubtask}
        onCheckedChange={
          isSubtask ? undefined : (checked) => onStatusChange(task.id, checked ? "done" : "todo")
        }
        className="shrink-0"
      />

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            ref={inputRef}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 p-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") inputRef.current?.blur()
              if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false) }
            }}
            autoFocus
          />
        ) : (
          <button
            className={`text-left w-full truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
            onClick={() => onClick()}
            onDoubleClick={() => !isSubtask && setEditingTitle(true)}
            title={isSubtask ? "Click to open" : "Click to open, double-click to edit"}
          >
            {task.title}
          </button>
        )}
      </div>

      {/* Phase */}
      <div className="w-28 shrink-0 hidden sm:block">
        {phase && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: phase.color + "22", color: phase.color }}
          >
            {phase.name}
          </span>
        )}
      </div>

      {/* Assignees */}
      <div className="flex -space-x-1 w-14 shrink-0 hidden md:flex">
        {task.assignees.slice(0, 3).map((a) => (
          <Avatar key={a.id} className="w-5 h-5 border border-background">
            <AvatarFallback className="bg-[#1a1a2e] text-white text-[8px]">
              {a.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>

      {/* Priority */}
      <div className="w-16 shrink-0 hidden lg:block">
        <span
          className="text-[10px] font-medium"
          style={{ color: PRIORITY_COLORS[task.priority] ?? "#888" }}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Due date */}
      <div className={`w-20 shrink-0 text-xs ${dueDateColor} hidden md:block`}>
        {task.due_date ? format(new Date(task.due_date), "dd MMM yy") : "—"}
      </div>

      {/* Status */}
      <div className="w-24 shrink-0 hidden sm:block">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusMeta.className}`}>
          {statusMeta.label}
        </Badge>
      </div>

      {/* Subtasks + attachments */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-16 shrink-0 hidden lg:flex">
        {task.subtask_count > 0 && <span>{task.subtask_count}↓</span>}
        {task.attachment_count > 0 && (
          <span className="flex items-center gap-0.5">
            <Paperclip className="w-2.5 h-2.5" />
            {task.attachment_count}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────

function GroupSection({
  groupKey,
  tasks,
  color,
  projectPhases,
  onTaskClick,
  onStatusChange,
  onTitleSave,
  onCreateTask,
  groupBy,
  expandedTaskIds,
  subtasksByParent,
  loadingSubtaskIds,
  onToggleExpand,
}: {
  groupKey: string
  tasks: TaskWithDetails[]
  color: string
  projectPhases: PhaseItem[]
  onTaskClick: (task: TaskWithDetails) => void
  onStatusChange: (id: string, status: string) => void
  onTitleSave: (id: string, title: string) => void
  onCreateTask: (title: string, groupKey: string) => Promise<void>
  groupBy: string
  expandedTaskIds: Set<string>
  subtasksByParent: Record<string, TaskWithDetails[]>
  loadingSubtaskIds: Set<string>
  onToggleExpand: (taskId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [quickTitle, setQuickTitle] = useState("")
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!quickTitle.trim()) return
    setAdding(true)
    await onCreateTask(quickTitle.trim(), groupKey)
    setQuickTitle("")
    setAdding(false)
  }

  return (
    <div className="mb-4">
      {/* Group header */}
      <button
        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-accent/20 rounded text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{groupKey}</span>
        <span className="text-xs text-muted-foreground ml-1">({tasks.length})</span>
      </button>

      {!collapsed && (
        <div className="ml-5 mt-1 border-l border-border/50 pl-3">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            <div className="w-4 shrink-0" />
            <div className="w-4 shrink-0" />
            <div className="flex-1">Task</div>
            <div className="w-28 shrink-0 hidden sm:block">Phase</div>
            <div className="w-14 shrink-0 hidden md:block">Who</div>
            <div className="w-16 shrink-0 hidden lg:block">Priority</div>
            <div className="w-20 shrink-0 hidden md:block">Due</div>
            <div className="w-24 shrink-0 hidden sm:block">Status</div>
            <div className="w-16 shrink-0 hidden lg:block" />
          </div>

          {tasks.map((task) => {
            const hasSubtasks = task.subtask_count > 0
            const expanded = expandedTaskIds.has(task.id)
            return (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  projectPhases={projectPhases}
                  onClick={() => onTaskClick(task)}
                  onStatusChange={onStatusChange}
                  onTitleSave={onTitleSave}
                  hasSubtasks={hasSubtasks}
                  expanded={expanded}
                  onToggleExpand={() => onToggleExpand(task.id)}
                />
                {expanded && (
                  <div>
                    {loadingSubtaskIds.has(task.id) && (
                      <div className="pl-9 py-1.5 text-xs text-muted-foreground">Loading subtasks…</div>
                    )}
                    {(subtasksByParent[task.id] ?? []).map((sub) => (
                      <TaskRow
                        key={sub.id}
                        task={sub}
                        projectPhases={projectPhases}
                        onClick={() => onTaskClick(sub)}
                        onStatusChange={onStatusChange}
                        onTitleSave={onTitleSave}
                        isSubtask
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Quick add row */}
          <div className="flex items-center gap-2 px-3 py-1 mt-1">
            <Checkbox disabled className="shrink-0 opacity-30" />
            <Input
              className="h-7 text-xs flex-1 focus-visible:ring-[#e94560]"
              placeholder="+ Add a task…"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            {quickTitle && (
              <Button
                size="sm"
                className="h-7 px-2 bg-[#e94560] hover:bg-[#c73652]"
                onClick={handleAdd}
                disabled={adding}
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ListView ────────────────────────────────────────────

interface ListViewProps {
  tasks: TaskWithDetails[]
  projectPhases: PhaseItem[]
  studioUsers: StudioUser[]
  groupBy: string
  currentUserId: string
  onTaskClick: (task: TaskWithDetails) => void
  onStatusChange: (taskId: string, newStatus: string) => void
  onTitleSave: (taskId: string, newTitle: string) => void
  onCreateTask: (title: string, status: string, meta?: { phase_tag?: string; priority?: string }) => Promise<void>
}

export function ListView({
  tasks,
  projectPhases,
  studioUsers,
  groupBy,
  onTaskClick,
  onStatusChange,
  onTitleSave,
  onCreateTask,
}: ListViewProps) {
  const { toast } = useToast()
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [subtasksByParent, setSubtasksByParent] = useState<Record<string, TaskWithDetails[]>>({})
  const [loadingSubtaskIds, setLoadingSubtaskIds] = useState<Set<string>>(new Set())

  async function handleToggleExpand(taskId: string) {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })

    if (subtasksByParent[taskId]) return

    setLoadingSubtaskIds((prev) => new Set(prev).add(taskId))
    try {
      const subs = await getSubtasks(taskId)
      setSubtasksByParent((prev) => ({ ...prev, [taskId]: subs }))
    } catch {
      toast({ title: "Failed to load subtasks", variant: "destructive" })
    } finally {
      setLoadingSubtaskIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  // Build groups
  const groupMap = new Map<string, TaskWithDetails[]>()
  for (const task of tasks) {
    const key = getGroupKey(task, groupBy, studioUsers)
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(task)
  }

  // Sort group keys sensibly
  const groupKeys = Array.from(groupMap.keys()).sort((a, b) => {
    if (groupBy === "priority") {
      const order = ["urgent", "high", "medium", "low"]
      return order.indexOf(a) - order.indexOf(b)
    }
    if (groupBy === "status") {
      const order = ["todo", "in_progress", "review", "done"]
      return order.indexOf(a) - order.indexOf(b)
    }
    return a.localeCompare(b)
  })

  async function handleCreateInGroup(title: string, groupKey: string) {
    const meta: Record<string, string> = {}
    if (groupBy === "phase" && groupKey !== "No Phase") meta.phase_tag = groupKey
    if (groupBy === "priority") meta.priority = groupKey
    if (groupBy === "status") meta.status = groupKey
    try {
      await onCreateTask(title, groupBy === "status" ? groupKey : "todo", meta as { phase_tag?: string; priority?: string })
    } catch {
      toast({ title: "Failed to create task", variant: "destructive" })
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    onStatusChange(taskId, status)
    try {
      await updateTask(taskId, { status })
    } catch {
      toast({ title: "Failed to update task", variant: "destructive" })
    }
  }

  async function handleTitleSave(taskId: string, newTitle: string) {
    onTitleSave(taskId, newTitle)
    try {
      await updateTask(taskId, { title: newTitle })
    } catch {
      toast({ title: "Failed to update task", variant: "destructive" })
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-sm text-muted-foreground">No tasks yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {groupKeys.map((key) => (
        <GroupSection
          key={key}
          groupKey={key}
          tasks={groupMap.get(key)!}
          color={getGroupColor(key, groupBy, projectPhases)}
          projectPhases={projectPhases}
          onTaskClick={onTaskClick}
          onStatusChange={handleStatusChange}
          onTitleSave={handleTitleSave}
          onCreateTask={handleCreateInGroup}
          groupBy={groupBy}
          expandedTaskIds={expandedTaskIds}
          subtasksByParent={subtasksByParent}
          loadingSubtaskIds={loadingSubtaskIds}
          onToggleExpand={handleToggleExpand}
        />
      ))}
    </div>
  )
}
