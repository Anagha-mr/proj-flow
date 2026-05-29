"use client"

import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Progress } from "@/components/ui/progress"
import { HealthScoreTooltip } from "./health-score-tooltip"
import type { DashboardProjectCard } from "@/app/actions/dashboard"

interface ProjectCardsStripProps {
  cards: DashboardProjectCard[]
}

const HEALTH_DOT_COLOR: Record<string, string> = {
  green: '#1D9E75',
  amber: '#BA7517',
  red: '#E24B4A',
}

function ProjectCard({ card }: { card: DashboardProjectCard }) {
  const healthColor = HEALTH_DOT_COLOR[card.healthScore] ?? '#1D9E75'
  const isRed = card.healthScore === 'red'

  const progressColor =
    card.progressPercent >= 100
      ? '#E24B4A'
      : card.progressPercent >= 75
      ? '#BA7517'
      : '#1D9E75'

  return (
    <Link
      href={`/dashboard/projects/${card.id}/overview`}
      className="shrink-0 rounded-[10px] overflow-hidden border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
      style={{ minWidth: 240, maxWidth: 280 }}
    >
      {/* Cover image */}
      <div className="relative h-[160px] bg-gradient-to-br from-surface to-muted flex items-center justify-center overflow-hidden">
        {card.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverImageUrl}
            alt={card.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground/30 select-none">
            {card.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        {/* Health dot — top right */}
        <div className="absolute top-2.5 right-2.5">
          <HealthScoreTooltip
            healthScore={card.healthScore}
            healthSignals={card.healthSignals}
          >
            <button
              onClick={(e) => e.preventDefault()}
              className={`w-3 h-3 rounded-full border-2 border-black/40 ${isRed ? 'animate-pulse' : ''}`}
              style={{ background: healthColor }}
              aria-label={`Health: ${card.healthScore}`}
            />
          </HealthScoreTooltip>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-1.5">
        <div>
          <p className="text-sm font-medium text-foreground truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {card.clientName}
            {card.currentPhase ? ` · ${card.currentPhase}` : ''}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Progress
              value={card.progressPercent}
              className="h-1.5 bg-white/10"
              style={{ '--progress-color': progressColor } as React.CSSProperties}
            />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {card.progressPercent}%
          </span>
        </div>

        {/* Next milestone */}
        {card.nextMilestone && (
          <p className="text-[11px] text-muted-foreground truncate">
            Next:{' '}
            <span className="text-foreground/70">{card.nextMilestone}</span>
            {card.nextMilestoneDate && (
              <> — {format(parseISO(card.nextMilestoneDate), 'd MMM')}</>
            )}
          </p>
        )}

        {/* Overdue count */}
        {card.overdueTaskCount > 0 && (
          <p className="text-xs font-medium" style={{ color: '#E24B4A' }}>
            {card.overdueTaskCount} overdue task{card.overdueTaskCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  )
}

export function ProjectCardsStrip({ cards }: ProjectCardsStripProps) {
  if (cards.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-[10px] border border-dashed border-white/10 bg-white/[0.02]"
        style={{ minHeight: 240, minWidth: 240, maxWidth: 280 }}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">No active projects</p>
          <Link
            href="/dashboard/projects/new"
            className="text-sm text-accent hover:underline"
          >
            + New Project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      <div className="flex gap-4" style={{ width: 'max-content' }}>
        {cards.map((card) => (
          <ProjectCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
