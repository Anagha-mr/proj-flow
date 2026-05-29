"use client"

import Link from "next/link"
import { AlertCircle, AlertTriangle, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PermissionGate } from "@/components/PermissionGate"
import type { ActivityFeedItem } from "@/app/actions/dashboard"

interface ActivityFeedProps {
  items: ActivityFeedItem[]
  leaveAlertCount: number
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: '#E24B4A',
    borderColor: '#E24B4A',
    label: 'CRITICAL',
  },
  warning: {
    icon: AlertTriangle,
    color: '#BA7517',
    borderColor: '#BA7517',
    label: 'WARNING',
  },
  info: {
    icon: Info,
    color: 'var(--muted-foreground)',
    borderColor: 'transparent',
    label: 'INFO',
  },
}

const TYPE_LINK_LABEL: Record<ActivityFeedItem['type'], string> = {
  overdue_task: 'View Task',
  unanswered_rfi: 'View RFI',
  overdue_invoice: 'View Invoice',
  pending_procurement: 'View Approvals',
  new_site_update: 'View Update',
}

export function ActivityFeed({ items, leaveAlertCount }: ActivityFeedProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Leave alert banner */}
      {leaveAlertCount > 0 && (
        <PermissionGate action="manage_team">
          <Alert className="bg-amber-950/30 border-amber-800/40">
            <AlertDescription className="flex items-center justify-between gap-2 text-amber-300 text-sm">
              <span>
                {leaveAlertCount} leave request{leaveAlertCount !== 1 ? 's' : ''} pending review.
              </span>
              <Link
                href="/dashboard/team"
                className="font-medium underline underline-offset-2 hover:no-underline shrink-0"
              >
                Review →
              </Link>
            </AlertDescription>
          </Alert>
        </PermissionGate>
      )}

      {/* Feed header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Activity &amp; Alerts</h2>
      </div>

      {/* Feed rows */}
      <div
        className="rounded-[10px] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-medium" style={{ color: '#1D9E75' }}>
              All clear — no alerts today ✓
            </p>
          </div>
        ) : (
          <div>
            {items.map((item, idx) => {
              const cfg = SEVERITY_CONFIG[item.severity]
              const Icon = cfg.icon
              const isLast = idx === items.length - 1

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4"
                  style={{
                    minHeight: 48,
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    borderLeft: `4px solid ${cfg.borderColor}`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />

                  <div className="flex-1 min-w-0 py-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span
                        className="text-[9px] font-bold tracking-wider shrink-0"
                        style={{ color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-foreground/80 truncate">{item.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{item.projectName}</p>
                  </div>

                  <Link
                    href={item.linkHref}
                    className="text-[11px] text-accent hover:underline shrink-0 font-medium"
                  >
                    {TYPE_LINK_LABEL[item.type]} →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
