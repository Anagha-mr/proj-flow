"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import type { HealthSignals } from "@/app/actions/dashboard"

interface HealthScoreTooltipProps {
  healthScore: 'green' | 'amber' | 'red'
  healthSignals: HealthSignals | null
  children: React.ReactNode
}

const STATUS_CONFIG = {
  green: { icon: CheckCircle2, color: 'text-[#1D9E75]', label: 'Green' },
  amber: { icon: AlertTriangle, color: 'text-[#BA7517]', label: 'Amber' },
  red: { icon: XCircle, color: 'text-[#E24B4A]', label: 'Red' },
}

function SignalRow({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'green' | 'amber' | 'red'
}) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
        <span className="text-xs text-text-secondary truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-secondary">{value}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          status === 'green' ? 'bg-emerald-900/40 text-emerald-400' :
          status === 'amber' ? 'bg-amber-900/40 text-amber-400' :
          'bg-red-900/40 text-red-400'
        }`}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

export function HealthScoreTooltip({ healthScore, healthSignals, children }: HealthScoreTooltipProps) {
  const overallCfg = STATUS_CONFIG[healthScore]
  const OverallIcon = overallCfg.icon

  const amberCount = healthSignals
    ? [
        healthSignals.overdue_tasks_status,
        healthSignals.unanswered_rfis_status,
        healthSignals.procurement_lag_status,
        healthSignals.invoice_overdue_status,
      ].filter((s) => s === 'amber').length
    : 0

  const redCount = healthSignals
    ? [
        healthSignals.overdue_tasks_status,
        healthSignals.unanswered_rfis_status,
        healthSignals.procurement_lag_status,
        healthSignals.invoice_overdue_status,
      ].filter((s) => s === 'red').length
    : 0

  const summary =
    healthScore === 'green'
      ? 'All signals healthy'
      : healthScore === 'red'
      ? `${redCount} signal${redCount !== 1 ? 's' : ''} require immediate attention`
      : `${amberCount} signal${amberCount !== 1 ? 's' : ''} require attention`

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="p-0 border-0 shadow-xl"
          style={{ width: 260 }}
        >
          <div className="bg-card border border-border rounded-[10px] p-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <OverallIcon className={`w-4 h-4 ${overallCfg.color}`} />
              <span className={`text-sm font-medium ${overallCfg.color}`}>
                {overallCfg.label} — {summary}
              </span>
            </div>

            {/* Signal rows */}
            {healthSignals ? (
              <div className="border-t border-border pt-2 flex flex-col gap-0.5">
                <SignalRow
                  label="Overdue tasks"
                  value={`${healthSignals.overdue_tasks}`}
                  status={healthSignals.overdue_tasks_status}
                />
                <SignalRow
                  label="Unanswered RFIs"
                  value={`${healthSignals.unanswered_rfis}`}
                  status={healthSignals.unanswered_rfis_status}
                />
                <SignalRow
                  label="Procurement lag"
                  value={healthSignals.procurement_lag_days_max > 0 ? `${healthSignals.procurement_lag_days_max} days` : '—'}
                  status={healthSignals.procurement_lag_status}
                />
                <SignalRow
                  label="Invoice payment"
                  value={healthSignals.invoice_overdue_days_max > 0 ? `${healthSignals.invoice_overdue_days_max} days` : '—'}
                  status={healthSignals.invoice_overdue_status}
                />
              </div>
            ) : (
              <p className="text-xs text-text-secondary border-t border-border pt-2">
                Health score calculating…
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
