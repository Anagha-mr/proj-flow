"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Circle, CheckCircle2, Clock } from "lucide-react"
import { getMyTasksToday, type MyTask } from "@/app/actions/tasks"

export function MyTasksWidget() {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  useEffect(() => {
    getMyTasksToday()
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  function getDueDateChip(dueDate: string) {
    if (dueDate < today) {
      return { label: 'Overdue', color: '#E24B4A', bg: 'rgba(226,75,74,0.15)' }
    }
    if (dueDate === today) {
      return { label: 'Today', color: '#BA7517', bg: 'rgba(186,117,23,0.15)' }
    }
    if (dueDate === tomorrow) {
      return { label: 'Tomorrow', color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' }
    }
    return {
      label: new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      color: '#1D9E75',
      bg: 'rgba(29,158,117,0.12)',
    }
  }

  const StatusIcon = ({ status }: { status: MyTask['status'] }) => {
    if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-[#1D9E75] shrink-0" />
    if (status === 'in_progress') return <Clock className="w-4 h-4 text-blue-400 shrink-0" />
    return <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
  }

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <h2 className="text-sm font-semibold text-foreground">My Tasks</h2>
        <span className="text-[11px] text-muted-foreground">Due this week</span>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="flex flex-col gap-0">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]"
            >
              <div className="w-4 h-4 rounded-full bg-white/10 animate-pulse shrink-0" />
              <div className="flex-1 h-3 rounded bg-white/10 animate-pulse" />
              <div className="w-14 h-4 rounded-full bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No tasks due this week 🎉</p>
        </div>
      ) : (
        <div>
          {tasks.map((task, idx) => {
            const chip = getDueDateChip(task.dueDate)
            const isLast = idx === tasks.length - 1

            return (
              <Link
                key={task.id}
                href={`/dashboard/projects/${task.projectId}/tasks`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  minHeight: 48,
                }}
              >
                <StatusIcon status={task.status} />

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/90 truncate">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{task.projectName}</p>
                </div>

                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{ color: chip.color, background: chip.bg }}
                >
                  {chip.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
