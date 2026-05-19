"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { exportPLToCSV, type GSTSummary } from "@/app/actions/studio-finance"
import { Download, AlertTriangle } from "lucide-react"

const INR = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

interface Props {
  summary: GSTSummary
  userRole: string
  periodFrom: string
  periodTo: string
}

export function GSTSummaryTab({ summary, userRole, periodFrom, periodTo }: Props) {
  const { toast } = useToast()
  const isOwner = userRole === "owner"

  async function handleExport() {
    try {
      const csv = await exportPLToCSV({ from: periodFrom, to: periodTo })
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ProjectFlow_Finance_${periodFrom}_${periodTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  const netLiabilityPositive = summary.net_gst_liability >= 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold">{summary.period_label}</p>
          <p className="text-sm text-muted-foreground">For CA Handover</p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center gap-2"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary cards 2×2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Output Tax Collected</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{INR(summary.output_tax_collected)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Input Tax Paid (Est.)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{INR(summary.input_tax_paid)}</p>
          </CardContent>
        </Card>

        <Card className={netLiabilityPositive ? "" : "border-[#e94560]/40 bg-red-50"}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Net GST Liability</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${netLiabilityPositive ? "text-green-700" : "text-[#e94560]"}`}>
              {INR(summary.net_gst_liability)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {netLiabilityPositive ? "Payable to government" : "Input exceeds output — verify with CA"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">Invoices Counted</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{summary.invoice_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* GST split breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">GST Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">CGST Collected</span>
            <span className="text-sm font-medium">{INR(summary.cgst_collected)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">SGST Collected</span>
            <span className="text-sm font-medium">{INR(summary.sgst_collected)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">IGST Collected</span>
            <span className="text-sm font-medium">{INR(summary.igst_collected)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Output Tax</span>
            <span className="text-sm font-bold">{INR(summary.output_tax_collected)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          This summary is for reference only. Consult your CA before filing GST returns. Input tax
          calculations are based on approved procurement items and may not reflect all eligible credits.
        </p>
      </div>
    </div>
  )
}
