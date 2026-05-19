"use client"

import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { updateProjectContractValue } from "@/app/actions/projects"
import { ProjectPLPanel } from "./project-pl-panel"
import type { ProjectPLRow } from "@/app/actions/studio-finance"
import { ChevronUp, ChevronDown } from "lucide-react"

const INR = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
}

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>
  const cls =
    pct >= 20
      ? "bg-green-100 text-green-800"
      : pct >= 0
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800"
  return <Badge className={`${cls} border-0 text-xs`}>{pct.toFixed(1)}%</Badge>
}

type SortKey = "gross_margin" | "total_collected" | "total_cost"
type SortDir = "asc" | "desc"

interface Props {
  rows: ProjectPLRow[]
  userRole: string
  onRowsChange: (rows: ProjectPLRow[]) => void
}

export function ProjectBreakdown({ rows, userRole, onRowsChange }: Props) {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("gross_margin")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedRow, setSelectedRow] = useState<ProjectPLRow | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // CV popover state
  const [cvProjectId, setCvProjectId] = useState<string | null>(null)
  const [cvInput, setCvInput] = useState("")
  const [savingCV, setSavingCV] = useState(false)

  const canEdit = userRole === "owner" || userRole === "senior_designer"

  const filtered = rows.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  )

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    return sortDir === "desc" ? vb - va : va - vb
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null
    return sortDir === "desc"
      ? <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : <ChevronUp className="w-3 h-3 inline ml-0.5" />
  }

  async function handleSaveCV(projectId: string) {
    const val = parseFloat(cvInput)
    if (isNaN(val) || val < 0) {
      toast({ title: "Enter a valid contract value", variant: "destructive" })
      return
    }
    setSavingCV(true)
    try {
      await updateProjectContractValue(projectId, val)
      onRowsChange(rows.map((r) => r.project_id === projectId ? { ...r, contract_value: val } : r))
      setCvProjectId(null)
      setCvInput("")
      toast({ title: "Contract value saved." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSavingCV(false)
    }
  }

  function handleContractValueUpdatedFromPanel(projectId: string, value: number | null) {
    onRowsChange(rows.map((r) => r.project_id === projectId ? { ...r, contract_value: value } : r))
    if (selectedRow?.project_id === projectId) {
      setSelectedRow((prev) => prev ? { ...prev, contract_value: value } : prev)
    }
  }

  // Summary row totals
  const totalInvoiced = sorted.reduce((s, r) => s + r.total_invoiced, 0)
  const totalCollected = sorted.reduce((s, r) => s + r.total_collected, 0)
  const totalCost = sorted.reduce((s, r) => s + r.total_cost, 0)
  const totalMargin = sorted.reduce((s, r) => s + r.gross_margin, 0)
  const avgMarginPct =
    totalCollected > 0 ? (totalMargin / totalCollected) * 100 : null

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 border border-dashed rounded-xl text-sm text-muted-foreground text-center px-4">
        No project data yet. Projects will appear here once invoices or costs are recorded.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left pb-2 pr-3 font-medium">Project</th>
              <th className="text-left pb-2 pr-3 font-medium">Client</th>
              <th className="text-right pb-2 pr-3 font-medium">Contract Value</th>
              <th className="text-right pb-2 pr-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("total_collected")}>
                Invoiced <SortIcon k="total_collected" />
              </th>
              <th className="text-right pb-2 pr-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("total_collected")}>
                Collected
              </th>
              <th className="text-right pb-2 pr-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("total_cost")}>
                Total Cost <SortIcon k="total_cost" />
              </th>
              <th className="text-right pb-2 pr-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("gross_margin")}>
                Gross Margin <SortIcon k="gross_margin" />
              </th>
              <th className="text-right pb-2 pr-3 font-medium">Margin %</th>
              <th className="text-left pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.project_id}
                className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => { setSelectedRow(row); setPanelOpen(true) }}
              >
                <td className="py-3 pr-3 font-medium truncate max-w-[160px]">{row.project_name}</td>
                <td className="py-3 pr-3 text-muted-foreground truncate max-w-[120px]">{row.client_name}</td>
                <td className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {row.contract_value != null ? (
                    INR(row.contract_value)
                  ) : canEdit ? (
                    <Popover
                      open={cvProjectId === row.project_id}
                      onOpenChange={(o) => { setCvProjectId(o ? row.project_id : null); setCvInput("") }}
                    >
                      <PopoverTrigger asChild>
                        <button className="text-xs text-[#e94560] hover:underline">Set value</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-3" align="end">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium">Contract Value ₹</span>
                          <Input
                            type="number"
                            min={0}
                            value={cvInput}
                            onChange={(e) => setCvInput(e.target.value)}
                            placeholder="0"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleSaveCV(row.project_id)} disabled={savingCV}>
                            Save
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-right">{INR(row.total_invoiced)}</td>
                <td className="py-3 pr-3 text-right">{INR(row.total_collected)}</td>
                <td className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default">{INR(row.total_cost)}</span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs space-y-1 p-2">
                        <div>Procurement: {INR(row.procurement_cost)}</div>
                        <div>Contractor: {INR(row.contractor_payments)}</div>
                        <div>Time: {INR(row.time_cost)}</div>
                        <div>Expenses: {INR(row.other_expenses)}</div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className={`py-3 pr-3 text-right font-medium ${row.gross_margin >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {INR(row.gross_margin)}
                </td>
                <td className="py-3 pr-3 text-right">
                  <MarginBadge pct={row.margin_percent} />
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {row.status.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Summary row */}
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20 font-semibold text-xs">
                <td className="py-2 pr-3" colSpan={3}>TOTAL ({sorted.length} projects)</td>
                <td className="py-2 pr-3 text-right">{INR(totalInvoiced)}</td>
                <td className="py-2 pr-3 text-right">{INR(totalCollected)}</td>
                <td className="py-2 pr-3 text-right">{INR(totalCost)}</td>
                <td className={`py-2 pr-3 text-right ${totalMargin >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {INR(totalMargin)}
                </td>
                <td className="py-2 pr-3 text-right">
                  {avgMarginPct != null ? `${avgMarginPct.toFixed(1)}%` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ProjectPLPanel
        row={selectedRow}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onContractValueUpdated={handleContractValueUpdatedFromPanel}
      />
    </div>
  )
}
