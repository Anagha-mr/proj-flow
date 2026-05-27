"use client"

/**
 * Sprint 15 — Timeline Tab
 * Extracted Gantt view from tasks-tab, now rendered at its own route:
 * /dashboard/projects/[id]/timeline
 *
 * Uses the exact same DHTMLX Gantt component and dynamic import pattern
 * that was previously inside tasks-tab.
 */

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { getTasks, getTaskDependencies } from "@/app/actions/tasks"
import type { TaskWithDetails, TaskDependency } from "@/app/actions/tasks"
import { GanttView } from "@/components/projects/tasks/gantt-view"
import { TaskDetailPanel } from "@/components/projects/tasks/task-detail-panel"
import { Skeleton } from "@/components/ui/skeleton"

interface TimelineTabProps {
  projectId: string
  projectPhases: Array<{ id: string; name: string; color: string; start_date?: string; end_date?: string }>
  userRole: string
  currentUserId: string
  studioUsers: Array<{ id: string; name: string; profile_photo_url: string | null; role: string }>
}

export function TimelineTab({
  projectId,
  projectPhases,
  userRole,
  currentUserId,
  studioUsers,
}: TimelineTabProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([getTasks(projectId), getTaskDependencies(projectId)])
      .then(([taskData, depData]) => {
        setTasks(taskData)
        setDependencies(depData)
      })
      .catch(() => toast({ title: "Failed to load timeline", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [projectId, toast])

  useEffect(() => { fetchData() }, [fetchData])

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

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Timeline</h2>
        <p className="text-xs text-muted-foreground">
          Drag task bars to reschedule · Click to open details
        </p>
      </div>

      <GanttView
        tasks={tasks}
        projectPhases={projectPhases}
        dependencies={dependencies}
        onTaskClick={(task) => { setSelectedTask(task); setPanelOpen(true) }}
        onStatusChange={handleStatusChange}
      />

      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelectedTask(null) }}
        projectPhases={projectPhases}
        studioUsers={studioUsers}
        currentUserId={currentUserId}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        dependencies={
          selectedTask
            ? dependencies
                .filter((d) => d.task_id === selectedTask.id)
                .map((d) => ({
                  task_id: d.task_id,
                  depends_on_task_id: d.depends_on_task_id,
                  depends_on_task: d.depends_on_task,
                }))
            : []
        }
        allProjectTasks={selectedTask ? tasks.filter((t) => t.id !== selectedTask.id) : []}
        onDependencyChange={fetchData}
      />
    </div>
  )
}
