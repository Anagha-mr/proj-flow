"use client"

import { FolderOpen, CheckSquare, IndianRupee } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { DashboardMetrics } from "@/app/actions/dashboard"

interface MetricCardsProps {
  metrics: DashboardMetrics
  showFinancials: boolean
}

export function MetricCards({ metrics, showFinancials }: MetricCardsProps) {
  const maxTasks = Math.max(...metrics.teamCapacity.map((m) => m.assignedTasksCount), 1)
  const topMembers = metrics.teamCapacity.slice(0, 4)
  const extraCount = metrics.teamCapacity.length - 4

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1 — Active Projects */}
      <Card
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
              Active Projects
            </p>
          </div>
          <p className="text-[22px] font-medium text-foreground leading-none">
            {metrics.activeProjectsCount}
          </p>
        </CardContent>
      </Card>

      {/* Card 2 — Tasks Due Today */}
      <Card
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="w-4 h-4 text-accent" />
            <p className="text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
              Tasks Due Today
            </p>
          </div>
          <p
            className="text-[22px] font-medium leading-none"
            style={{ color: metrics.tasksDueTodayCount > 0 ? 'var(--accent)' : 'var(--foreground)' }}
          >
            {metrics.tasksDueTodayCount}
          </p>
        </CardContent>
      </Card>

      {/* Card 3 — Outstanding Payments (owner/senior_designer only) */}
      {showFinancials ? (
        <Card
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-4 h-4 text-accent" />
              <p className="text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                Outstanding Payments
              </p>
            </div>
            <p className="text-[22px] font-medium text-foreground leading-none">
              {metrics.overdueInvoicesTotal.toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
              })}
            </p>
            {metrics.overdueInvoicesCount > 0 && (
              <p className="text-xs mt-1" style={{ color: '#E24B4A' }}>
                {metrics.overdueInvoicesCount} invoice{metrics.overdueInvoicesCount !== 1 ? 's' : ''} overdue
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div />
      )}

      {/* Card 4 — Team Capacity (owner/senior_designer only) */}
      {showFinancials ? (
        <Card
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
          }}
        >
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase mb-3">
              Team Capacity
            </p>
            {metrics.teamCapacity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active task assignments</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topMembers.map((member) => {
                  const barPercent = (member.assignedTasksCount / maxTasks) * 100
                  const hasOverdue = member.overdueTasksCount > 0
                  const initials = member.userName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <div key={member.userId} className="flex items-center gap-2">
                      <Avatar className="w-5 h-5 shrink-0">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.userName} />}
                        <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate" style={{ maxWidth: 80 }}>
                        {member.userName.split(' ')[0]}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barPercent}%`,
                            background: hasOverdue ? '#E24B4A' : '#1D9E75',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {member.assignedTasksCount}
                      </span>
                    </div>
                  )
                })}
                {extraCount > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">+{extraCount} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div />
      )}
    </div>
  )
}
