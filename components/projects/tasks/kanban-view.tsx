"use client"

import { useState, useRef } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format, isToday, isPast, differenceInDays } from "date-fns"
import { Plus, Paperclip, GripVertical } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { updateTaskStatus } from "@/app/actions/tasks"
import type { TaskWithDetails } from "@/app/actions/tasks"

const PRIORITY_COLORS: Record<string, { dot: string; label: string }> = {
  urgent: { dot: "bg-[#e94560]", label: "text-[#e94560]" },
  high: { dot: "bg-[#f97316]", label: "text-[#f97316]" },
  medium: { dot: "bg-[#f59e0b]", label: "text-[#f59e0b]" },
  low: { dot: "bg-[#10b981]", label: "text-[#10b981]" },
}

const COLUMNS = [
  { id: "todo", label: "To Do", headerColor: "text-[#e94560]", countBg: "bg-[#e94560]/10 text-[#e94560]" },
  { id: "in_progress", label: "In Progress", headerColor: "text-blue-600", countBg: "bg-blue-50 text-blue-600" },
  { id: "review", label: "Review", headerColor: "text-purple-600", countBg: "bg-purple-50 text-purple-600" },
  { id: "done", label: "Done", headerColor: "text-green-600", countBg: "bg-green-50 text-green-600" },
]

type PhaseItem = { id: string; name: string; color: string }
type StudioUser = { id: string; name: string; profile_photo_url: string | null; role: string }

interface Props {
  tasks: TaskWithDetails[]
  projectPhases: PhaseItem[]
  studioUsers: StudioUser[]
  onTaskClick: (task: TaskWithDetails) => void
  onStatusChange: (taskId: string, newStatus: string) => void
  onCreateTask: (title: string, status: string) => Promise<void>
}

// ─── Droppable column ─────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  projectPhases,
  activeTaskId,
  onTaskClick,
  onCreateTask,
}: {
  column: (typeof COLUMNS)[number]
  tasks: TaskWithDetails[]
  projectPhases: PhaseItem[]
  activeTaskId: string | null
  onTaskClick: (task: TaskWithDetails) => void
  onCreateTask: (title: string, status: string) => Promise<void>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [quickTitle, setQuickTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleQuickAdd() {
    if (!quickTitle.trim()) return
    setAdding(true)
    await onCreateTask(quickTitle.trim(), column.id)
    setQuickTitle("")
    setAdding(false)
  }

  return (
    <div className="flex flex-col flex-1 min-w-[270px] max-w-[340px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-semibold ${column.headerColor}`}>{column.label}</h3>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${column.countBg}`}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Droppable card list */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[500px] overflow-y-auto p-2 rounded-lg border-2 transition-colors ${
          isOver ? "bg-accent/10 border-accent/40" : "border-transparent"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              projectPhases={projectPhases}
              isDragOverlay={false}
              isBeingDragged={activeTaskId === task.id}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg min-h-[80px]">
            <p className="text-xs text-muted-foreground">No tasks</p>
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="mt-2 flex gap-1.5">
        <Input
          ref={inputRef}
          className="h-8 text-xs focus-visible:ring-[#e94560]"
          placeholder="+ Add task…"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleQuickAdd()
          }}
        />
        {quickTitle && (
          <Button
            size="sm"
            className="h-8 px-2 bg-[#e94560] hover:bg-[#c73652] shrink-0"
            onClick={handleQuickAdd}
            disabled={adding}
          >
            <Plus className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Sortable card wrapper ────────────────────────────────────

function SortableCard({
  task,
  projectPhases,
  isDragOverlay,
  isBeingDragged,
  onClick,
}: {
  task: TaskWithDetails
  projectPhases: PhaseItem[]
  isDragOverlay: boolean
  isBeingDragged: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        projectPhases={projectPhases}
        isDragOverlay={isDragOverlay}
        isBeingDragged={isBeingDragged}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────

function TaskCard({
  task,
  projectPhases,
  isDragOverlay,
  isBeingDragged,
  onClick,
  dragHandleProps,
}: {
  task: TaskWithDetails
  projectPhases: PhaseItem[]
  isDragOverlay: boolean
  isBeingDragged: boolean
  onClick: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  const phase = projectPhases.find((p) => p.name === task.phase_tag)
  const priorityMeta = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium

  const dueDateColor =
    task.due_date
      ? isPast(new Date(task.due_date)) && task.status !== "done"
        ? "text-[#e94560]"
        : differenceInDays(new Date(task.due_date), new Date()) <= 3
        ? "text-amber-500"
        : "text-muted-foreground"
      : ""

  return (
    <div
      className={`bg-card border rounded-lg p-3 transition-shadow group ${
        isDragOverlay ? "shadow-lg rotate-1 cursor-grabbing" : "hover:shadow-sm cursor-grab"
      } ${isBeingDragged ? "opacity-40" : "opacity-100"}`}
      onClick={!isDragOverlay ? onClick : undefined}
    >
      <div className="flex items-start gap-1.5">
        <div
          {...dragHandleProps}
          className="mt-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-70 shrink-0 cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug mb-2">{task.title}</p>

          <div className="flex flex-wrap gap-1 mb-2">
            {phase && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: phase.color + "22", color: phase.color }}
              >
                {phase.name}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[10px] font-medium ${priorityMeta.label}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Due date */}
              {task.due_date && (
                <span className={`text-[10px] ${dueDateColor}`}>
                  {isToday(new Date(task.due_date))
                    ? "Today"
                    : format(new Date(task.due_date), "dd MMM")}
                </span>
              )}
              {/* Subtasks */}
              {task.subtask_count > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {task.subtask_count} subtask{task.subtask_count !== 1 ? "s" : ""}
                </span>
              )}
              {/* Attachments */}
              {task.attachment_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Paperclip className="w-2.5 h-2.5" />
                  {task.attachment_count}
                </span>
              )}
            </div>

            {/* Assignee avatars */}
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} className="w-5 h-5 border border-background">
                  <AvatarFallback className="bg-[#1a1a2e] text-white text-[8px]">
                    {a.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.assignees.length > 3 && (
                <Avatar className="w-5 h-5 border border-background">
                  <AvatarFallback className="bg-gray-400 text-white text-[8px]">
                    +{task.assignees.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main KanbanView ──────────────────────────────────────────

export function KanbanView({ tasks, projectPhases, studioUsers: _, onTaskClick, onStatusChange, onCreateTask }: Props) {
  const { toast } = useToast()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTaskId(null)
    if (!over) return

    const activeTaskId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find((t) => t.id === activeTaskId)
    if (!activeTask) return

    const isColumn = COLUMNS.some((c) => c.id === overId)
    let targetStatus: string

    if (isColumn) {
      targetStatus = overId
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (!overTask) return
      targetStatus = overTask.status
    }

    if (activeTask.status === targetStatus) return

    // Optimistic update
    onStatusChange(activeTaskId, targetStatus)

    updateTaskStatus(activeTaskId, targetStatus).catch(() => {
      // Revert
      onStatusChange(activeTaskId, activeTask.status)
      toast({ title: "Failed to update task status", variant: "destructive" })
    })
  }

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null

  const tasksByStatus = (status: string) =>
    tasks.filter((t) => {
      if (status === "in_progress") return t.status === "in_progress" || t.status === "review"
      return t.status === status
    })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            projectPhases={projectPhases}
            activeTaskId={activeTaskId}
            onTaskClick={onTaskClick}
            onCreateTask={onCreateTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            projectPhases={projectPhases}
            isDragOverlay
            isBeingDragged={false}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
