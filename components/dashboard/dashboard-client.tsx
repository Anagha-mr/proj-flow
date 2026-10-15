"use client"

import { useMemo } from "react"
import { PermissionGate } from "@/components/PermissionGate"
import { usePermission } from "@/hooks/usePermission"
import { MetricCards } from "./metric-cards"
import { ProjectCardsStrip } from "./project-cards-strip"
import { ActivityFeed } from "./activity-feed"
import { MyTasksWidget } from "./my-tasks-widget"
import { NarrativesDashboardSection } from "@/components/narratives/narratives-dashboard-section"
import { AISuggestionsTray } from "@/components/gmail/ai-suggestions-tray"
import type {
  DashboardMetrics,
  DashboardProjectCard,
  ActivityFeedItem,
} from "@/app/actions/dashboard"
import type { WeeklyNarrative } from "@/app/actions/narratives"
import type { AISuggestion } from "@/app/actions/gmail"

interface DashboardClientProps {
  firstName: string
  role: string
  metrics: DashboardMetrics
  projectCards: DashboardProjectCard[]
  activityFeed: ActivityFeedItem[]
  leaveAlertCount: number
  pendingNarratives: WeeklyNarrative[]
  aiSuggestions: AISuggestion[]
  gmailConnected: boolean
  gmailAddress: string | null
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  owner: { label: 'Owner', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  senior_designer: { label: 'Senior Designer', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
  designer: { label: 'Designer', bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
  intern: { label: 'Intern', bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
}

function getGreeting(role: string): string {
  const h = new Date().getHours()
  const time =
    h >= 5 && h < 12 ? 'morning' :
    h >= 12 && h < 18 ? 'afternoon' : 'evening'
  void role
  return `Good ${time}`
}

export function DashboardClient({
  firstName,
  role,
  metrics,
  projectCards,
  activityFeed,
  leaveAlertCount,
  pendingNarratives,
  aiSuggestions,
  gmailConnected,
  gmailAddress,
}: DashboardClientProps) {
  const showFinancials = usePermission('view_financials')
  const canManageStudio = usePermission('manage_studio')
  const isDesignerOrIntern = role === 'designer' || role === 'intern'

  const badge = ROLE_BADGE[role] ?? ROLE_BADGE.designer
  const greeting = useMemo(() => getGreeting(role), [role])

  // Filter out invoice feed items for designer/intern
  const visibleFeed = isDesignerOrIntern
    ? activityFeed.filter((item) => item.type !== 'overdue_invoice')
    : activityFeed

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}, {firstName} 
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&rsquo;s your studio at a glance
          </p>
        </div>
        <span
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* Metric cards — server-rendered data, no skeleton needed */}
      <MetricCards metrics={metrics} showFinancials={showFinancials} />

      {/* AI Suggestions tray — owner + senior_designer only */}
      {canManageStudio && (
        <AISuggestionsTray
          suggestions={aiSuggestions}
          gmailConnected={gmailConnected}
          gmailAddress={gmailAddress}
        />
      )}

      {/* Designer/intern role: show My Tasks widget first */}
      {isDesignerOrIntern && (
        <section>
          <MyTasksWidget />
        </section>
      )}

      {/* Project cards strip */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Active Projects</h2>
        <ProjectCardsStrip cards={projectCards} />
      </section>

      {/* Weekly Client Updates — only shown on Mondays or when drafts exist */}
      <NarrativesDashboardSection
        initialNarratives={pendingNarratives}
        userRole={role}
      />

      {/* Activity & Alerts feed */}
      <ActivityFeed items={visibleFeed} leaveAlertCount={leaveAlertCount} />
    </div>
  )
}
