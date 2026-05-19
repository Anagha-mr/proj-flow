"use client"

import { useState, useTransition } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  getStudioPLSummary,
  getGSTSummary,
  exportPLToCSV,
  type StudioPLSummary,
  type ProjectPLRow,
  type StudioExpense,
  type GSTSummary,
} from "@/app/actions/studio-finance"
import { PLOverview } from "./pl-overview"
import { ProjectBreakdown } from "./project-breakdown"
import { GSTSummaryTab } from "./gst-summary"

type PeriodType = "month" | "quarter" | "year" | "custom"

interface Props {
  initialPLSummary: StudioPLSummary
  initialProjectRows: ProjectPLRow[]
  initialStudioExpenses: StudioExpense[]
  initialGSTSummary: GSTSummary
  userRole: string
  currentYear: number
}

export function StudioFinanceClient({
  initialPLSummary,
  initialProjectRows,
  initialStudioExpenses,
  initialGSTSummary,
  userRole,
  currentYear,
}: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [periodType, setPeriodType] = useState<PeriodType>("year")
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const [plSummary, setPLSummary] = useState(initialPLSummary)
  const [projectRows, setProjectRows] = useState(initialProjectRows)
  const [studioExpenses, setStudioExpenses] = useState(initialStudioExpenses)
  const [gstSummary, setGSTSummary] = useState(initialGSTSummary)

  const isOwner = userRole === "owner"

  function buildPeriodArgs() {
    if (periodType === "year") return { type: "annual" as const, year }
    if (periodType === "quarter") return { type: "quarterly" as const, year, quarter }
    if (periodType === "month") return { type: "monthly" as const, year, month }
    return { type: "annual" as const, year }
  }

  function refreshData() {
    const args = buildPeriodArgs()
    const from = periodToRange(args).from
    const to = periodToRange(args).to

    startTransition(async () => {
      try {
        const [newPL, newGST] = await Promise.all([
          getStudioPLSummary(args),
          getGSTSummary({ from, to }),
        ])
        setPLSummary(newPL)
        setGSTSummary(newGST)
      } catch {
        toast({ title: "Failed to refresh data", variant: "destructive" })
      }
    })
  }

  function navigate(dir: "prev" | "next") {
    if (periodType === "year") {
      const newYear = dir === "prev" ? year - 1 : year + 1
      setYear(newYear)
      const args = { type: "annual" as const, year: newYear }
      const { from, to } = periodToRange(args)
      startTransition(async () => {
        const [newPL, newGST] = await Promise.all([
          getStudioPLSummary(args),
          getGSTSummary({ from, to }),
        ])
        setPLSummary(newPL)
        setGSTSummary(newGST)
      })
    } else if (periodType === "quarter") {
      let q = quarter + (dir === "next" ? 1 : -1)
      let y = year
      if (q > 4) { q = 1; y++ }
      if (q < 1) { q = 4; y-- }
      setQuarter(q)
      setYear(y)
      const args = { type: "quarterly" as const, year: y, quarter: q }
      const { from, to } = periodToRange(args)
      startTransition(async () => {
        const [newPL, newGST] = await Promise.all([
          getStudioPLSummary(args),
          getGSTSummary({ from, to }),
        ])
        setPLSummary(newPL)
        setGSTSummary(newGST)
      })
    } else if (periodType === "month") {
      let m = month + (dir === "next" ? 1 : -1)
      let y = year
      if (m > 12) { m = 1; y++ }
      if (m < 1) { m = 12; y-- }
      setMonth(m)
      setYear(y)
      const args = { type: "monthly" as const, year: y, month: m }
      const { from, to } = periodToRange(args)
      startTransition(async () => {
        const [newPL, newGST] = await Promise.all([
          getStudioPLSummary(args),
          getGSTSummary({ from, to }),
        ])
        setPLSummary(newPL)
        setGSTSummary(newGST)
      })
    }
  }

  function onPeriodTypeChange(val: string) {
    setPeriodType(val as PeriodType)
    setTimeout(() => refreshData(), 0)
  }

  async function handleExportCSV() {
    const args = buildPeriodArgs()
    const { from, to } = periodToRange(args)
    try {
      const csv = await exportPLToCSV({ from, to })
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ProjectFlow_Finance_${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  const periodLabel = plSummary.period_label

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Studio Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">P&amp;L, project profitability, and GST summary</p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center gap-2"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={periodType} onValueChange={onPeriodTypeChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate("prev")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : periodLabel}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigate("next")}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="overflow-x-auto flex w-full justify-start h-auto bg-transparent border-b rounded-none p-0 gap-0 mb-6">
          {[
            { label: "P&L Overview", value: "overview" },
            { label: "Project Breakdown", value: "projects" },
            { label: "GST Summary", value: "gst" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#e94560] data-[state=active]:bg-transparent data-[state=active]:text-[#e94560] px-4 pb-2 shrink-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <PLOverview
            summary={plSummary}
            studioExpenses={studioExpenses}
            userRole={userRole}
            isPending={isPending}
            onExpensesChange={setStudioExpenses}
          />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectBreakdown
            rows={projectRows}
            userRole={userRole}
            onRowsChange={setProjectRows}
          />
        </TabsContent>

        <TabsContent value="gst">
          <GSTSummaryTab
            summary={gstSummary}
            userRole={userRole}
            periodFrom={periodToRange(buildPeriodArgs()).from}
            periodTo={periodToRange(buildPeriodArgs()).to}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function periodToRange(args: {
  type: 'monthly' | 'quarterly' | 'annual' | 'custom'
  year?: number
  quarter?: number
  month?: number
  from?: string
  to?: string
}): { from: string; to: string } {
  const y = args.year ?? new Date().getFullYear()

  if (args.type === 'annual') return { from: `${y}-01-01`, to: `${y}-12-31` }

  if (args.type === 'quarterly') {
    const q = args.quarter ?? 1
    const ranges: Record<number, { from: string; to: string }> = {
      1: { from: `${y}-01-01`, to: `${y}-03-31` },
      2: { from: `${y}-04-01`, to: `${y}-06-30` },
      3: { from: `${y}-07-01`, to: `${y}-09-30` },
      4: { from: `${y}-10-01`, to: `${y}-12-31` },
    }
    return ranges[q] ?? ranges[1]
  }

  if (args.type === 'monthly') {
    const m = args.month ?? 1
    const mm = m.toString().padStart(2, '0')
    const lastDay = new Date(y, m, 0).getDate()
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${lastDay}` }
  }

  return { from: args.from ?? `${y}-01-01`, to: args.to ?? `${y}-12-31` }
}
