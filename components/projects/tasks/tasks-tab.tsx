"use client"

import { useState, useEffect, useCallback } from "react"
import { LayoutGrid, List, BarChart2, Plus, Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { getTasks, createTask } from "@/app/actions/tasks"
import type { TaskWithDetails } from "@/app/actions/tasks"
import { KanbanView } from "./kanban-view"
import { ListView } from "./list-view"
import { TaskDetailPanel } from "./task-detail-panel"

type PhaseItem = { id: string; name: string; color: string }
type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }

const GROUP_OPTIONS = [
  { value: "phase", label: "Phase" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "room", label: "Room" },
  { value: "assignee", label: "Assignee" },
]

const PRIORITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

interface Props {
  projectId: string
  projectPhases: PhaseItem[]
  userRole: string
  currentUserId: string
  studioUsers: StudioUser[]
}

export function TasksTab({ projectId, projectPhases, userRole, currentUserId, studioUsers }: Props) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [groupBy, setGroupBy] = useState("phase")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const isIntern = userRole === "intern"

  const fetchTasks = useCallback(() => {
    setLoading(true)
    getTasks(projectId)
      .then((data) => setTasks(data))
      .catch(() => toast({ title: "Failed to load tasks", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [projectId, toast])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    if (isIntern && !t.assignees.some((a) => a.id === currentUserId)) return false
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Status summary counts (from full tasks list, not filtered)
  const internTasks = isIntern ? tasks.filter((t) => t.assignees.some((a) => a.id === currentUserId)) : tasks
  const todoCnt = internTasks.filter((t) => t.status === "todo").length
  const inProgressCnt = internTasks.filter((t) => t.status === "in_progress" || t.status === "review").length
  const doneCnt = internTasks.filter((t) => t.status === "done").length

  function openTask(task: TaskWithDetails) {
    setSelectedTask(task)
    setPanelOpen(true)
  }

  function openNewTask() {
    // Create a temporary "new task" template
    const newTaskTemplate: TaskWithDetails = {
      id: "",
      studio_id: "",
      project_id: projectId,
      parent_task_id: null,
      title: "New Task",
      description: null,
      status: "todo",
      priority: "medium",
      phase_tag: null,
      room_tag: null,
      start_date: null,
      due_date: null,
      progress_percent: 0,
      is_recurring: false,
      position: 0,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: [],
      subtask_count: 0,
      attachment_count: 0,
    }
    // Actually create it first, then open the panel
    createTask({
      project_id: projectId,
      title: "New Task",
      status: "todo",
      assignee_ids: [currentUserId],
    })
      .then((task) => {
        setTasks((prev) => [task, ...prev])
        openTask(task)
      })
      .catch(() => toast({ title: "Failed to create task", variant: "destructive" }))
    void newTaskTemplate
  }

  const handleCreateTask = useCallback(
    async (title: string, status: string, meta?: { phase_tag?: string; priority?: string }) => {
      try {
        const task = await createTask({
          project_id: projectId,
          title,
          status,
          phase_tag: meta?.phase_tag ?? null,
          priority: meta?.priority ?? "medium",
          assignee_ids: [currentUserId],
        })
        setTasks((prev) => [...prev, task])
      } catch {
        toast({ title: "Failed to create task", variant: "destructive" })
      }
    },
    [projectId, currentUserId, toast]
  )

  const handleUpdateTask = useCallback(
    (id: string, updates: Partial<TaskWithDetails>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
      if (selectedTask?.id === id) {
        setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev))
      }
    },
    [selectedTask?.id]
  )

  const handleDeleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setSelectedTask(null)
    setPanelOpen(false)
  }, [])

  const handleStatusChange = useCallback((taskId: string, newStatus: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
  }, [])

  const handleTitleSave = useCallback((taskId: string, newTitle: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t)))
  }, [])

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Top bar row 1: title + view + add button */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold flex-1 min-w-0">
            {isIntern ? "My Tasks" : "Tasks"}
          </h2>

          {/* View switcher */}
          <div className="flex items-center gap-0 border rounded-md overflow-hidden">
            <Button
              variant={view === "kanban" ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-3 rounded-none gap-1.5 ${view === "kanban" ? "bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]" : ""}`}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-3 rounded-none gap-1.5 ${view === "list" ? "bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]" : ""}`}
              onClick={() => setView("list")}
            >
              <List className="w-3.5 h-3.5" />
              List
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 rounded-none gap-1.5 opacity-40 cursor-not-allowed"
                  disabled
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Timeline
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coming in Sprint 3B</TooltipContent>
            </Tooltip>
          </div>

          <Button
            size="sm"
            className="h-8 bg-[#e94560] hover:bg-[#c73652] gap-1.5"
            onClick={openNewTask}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </Button>
        </div>

        {/* Top bar row 2: filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Group by */}
          {view === "list" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  Group: {GROUP_OPTIONS.find((g) => g.value === groupBy)?.label}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {GROUP_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => setGroupBy(opt.value)}>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Priority filter */}
          <div className="flex items-center gap-1">
            {PRIORITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPriorityFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  priorityFilter === f.value
                    ? "bg-[#1a1a2e] text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs w-44 focus-visible:ring-[#e94560]"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#e94560]/20 bg-[#e94560]/5 px-4 py-3">
            <p className="text-xs text-[#e94560] font-medium mb-1">To Do</p>
            <p className="text-2xl font-bold text-[#e94560]">{todoCnt}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-600 font-medium mb-1">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{inProgressCnt}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs text-green-600 font-medium mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{doneCnt}</p>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex gap-4 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex flex-col gap-2 min-w-[250px]">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Views */}
        {!loading && view === "kanban" && (
          <KanbanView
            tasks={filteredTasks}
            projectPhases={projectPhases}
            studioUsers={studioUsers}
            onTaskClick={openTask}
            onStatusChange={handleStatusChange}
            onCreateTask={handleCreateTask}
          />
        )}

        {!loading && view === "list" && (
          <ListView
            tasks={filteredTasks}
            projectPhases={projectPhases}
            studioUsers={studioUsers}
            groupBy={groupBy}
            currentUserId={currentUserId}
            onTaskClick={openTask}
            onStatusChange={handleStatusChange}
            onTitleSave={handleTitleSave}
            onCreateTask={handleCreateTask}
          />
        )}
      </div>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelectedTask(null) }}
        projectPhases={projectPhases}
        studioUsers={studioUsers}
        currentUserId={currentUserId}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </TooltipProvider>
  )
}
