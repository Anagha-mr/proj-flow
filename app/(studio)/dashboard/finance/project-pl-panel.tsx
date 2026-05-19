"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { updateProjectContractValue } from "@/app/actions/projects"
import type { ProjectPLRow } from "@/app/actions/studio-finance"
import { ExternalLink } from "lucide-react"

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
  return <Badge className={`${cls} border-0`}>{pct.toFixed(1)}%</Badge>
}

interface Props {
  row: ProjectPLRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContractValueUpdated: (projectId: string, value: number | null) => void
}

export function ProjectPLPanel({ row, open, onOpenChange, onContractValueUpdated }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [cvInput, setCvInput] = useState("")
  const [cvPopoverOpen, setCvPopoverOpen] = useState(false)
  const [savingCV, setSavingCV] = useState(false)

  if (!row) return null

  const outstanding = row.total_invoiced - row.total_collected

  async function handleSaveContractValue() {
    const val = parseFloat(cvInput)
    if (isNaN(val) || val < 0) {
      toast({ title: "Enter a valid contract value", variant: "destructive" })
      return
    }
    setSavingCV(true)
    try {
      await updateProjectContractValue(row!.project_id, val)
      onContractValueUpdated(row!.project_id, val)
      setCvPopoverOpen(false)
      setCvInput("")
      toast({ title: "Contract value saved." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSavingCV(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] sm:w-[560px] flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            <span>{row.project_name}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-sm text-muted-foreground">{row.client_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-600"}`}>
              {row.status.replace("_", " ")}
            </span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-4">
          {/* Section 1 — Revenue */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contract Value</span>
                {row.contract_value != null ? (
                  <span className="text-sm font-medium">{INR(row.contract_value)}</span>
                ) : (
                  <Popover open={cvPopoverOpen} onOpenChange={setCvPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-xs text-[#e94560] hover:underline">Set value</button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="end">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium">Contract Value ₹</span>
                        <Input
                          type="number"
                          min={0}
                          value={cvInput}
                          onChange={(e) => setCvInput(e.target.value)}
                          placeholder="e.g. 500000"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={handleSaveContractValue} disabled={savingCV}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setCvPopoverOpen(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Invoiced</span>
                <span className="text-sm font-medium">{INR(row.total_invoiced)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Collected</span>
                <span className="text-sm font-medium">{INR(row.total_collected)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className={`text-sm font-medium ${outstanding > 0 ? "text-red-600" : ""}`}>
                  {INR(outstanding)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2 — Costs */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Costs</p>
            <div className="flex flex-col gap-2">
              <CostRow label="Procurement" value={row.procurement_cost} />
              <CostRow label="Contractor Payments" value={row.contractor_payments} />
              <CostRow label="Designer Time" value={row.time_cost} />
              <CostRow label="Other Expenses" value={row.other_expenses} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total Cost</span>
              <span className="text-sm font-bold">{INR(row.total_cost)}</span>
            </div>
          </div>

          <Separator />

          {/* Section 3 — Margin */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margin</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gross Margin</span>
                <span className={`text-sm font-bold ${row.gross_margin >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {INR(row.gross_margin)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Margin %</span>
                <MarginBadge pct={row.margin_percent} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t pt-4">
          <Button
            className="w-full"
            onClick={() => {
              router.push(`/dashboard/projects/${row.project_id}`)
              onOpenChange(false)
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Project
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{(value).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
    </div>
  )
}
