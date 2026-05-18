"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Download, CheckCircle2 } from "lucide-react"
import type { QuoteRequest, QuoteResponse } from "@/app/actions/quotes"
import { selectWinningQuote } from "@/app/actions/quotes"
import { formatCurrency } from "@/components/vendors/vendor-utils"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface QuoteComparisonPanelProps {
  request: QuoteRequest | null
  onClose: () => void
  onWinnerSelected: () => void
}

export function QuoteComparisonPanel({ request, onClose, onWinnerSelected }: QuoteComparisonPanelProps) {
  const { toast } = useToast()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [confirmResp, setConfirmResp] = useState<QuoteResponse | null>(null)

  if (!request) return null

  const responses = request.responses ?? []
  const prices = responses.map((r) => r.unit_price)
  const minPrice = prices.length > 0 ? Math.min(...prices) : Infinity
  const leadTimes = responses.map((r) => r.lead_time_days).filter((d): d is number => d !== null)
  const minLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : Infinity

  const respondedVendorIds = new Set(responses.map((r) => r.vendor_id))
  const allVendorIds = request.vendor_ids ?? []

  async function handleSelectWinner(resp: QuoteResponse) {
    setSelecting(resp.id)
    try {
      await selectWinningQuote(resp.id)
      setDone(true)
      setConfirmResp(null)
      onWinnerSelected()
      toast({ title: "Winner selected. Item cost and status updated." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSelecting(null)
    }
  }

  return (
    <Sheet open={!!request} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[820px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex flex-col gap-0.5">
            <span>{request.item_name} — Quote Comparison</span>
            {request.response_deadline && (
              <span className="text-xs font-normal text-muted-foreground">
                Deadline: {format(new Date(request.response_deadline), 'd MMM yyyy, h:mm a')}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {confirmResp && !done && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium mb-3">
              Select {confirmResp.vendor_name} at {formatCurrency(confirmResp.unit_price)}/unit for {request.item_name}?
              This will update the item&apos;s cost and close the quote request.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSelectWinner(confirmResp)} disabled={!!selecting} className="bg-[#e94560] hover:bg-[#c73652]">
                {selecting ? 'Selecting…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmResp(null)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-4 sm:overflow-x-auto">
          {allVendorIds.map((vendorId) => {
            const resp = responses.find((r) => r.vendor_id === vendorId)
            const isLowest = resp && resp.unit_price === minPrice && prices.length > 1
            const isFastest = resp?.lead_time_days && resp.lead_time_days === minLeadTime && leadTimes.length > 1
            const isSelected = done && resp?.is_selected

            if (!respondedVendorIds.has(vendorId)) {
              return (
                <div key={vendorId} className="border rounded-xl p-5 w-full sm:w-64 bg-gray-50 opacity-60">
                  <p className="font-semibold text-sm">{resp?.vendor_name ?? vendorId}</p>
                  <p className="text-sm text-muted-foreground mt-3">Awaiting response…</p>
                </div>
              )
            }

            if (!resp) return null

            return (
              <div
                key={vendorId}
                className={`border rounded-xl p-5 w-full sm:w-64 flex flex-col gap-3 ${isSelected ? 'ring-2 ring-green-500 border-green-300' : isLowest ? 'ring-2 ring-[#e94560]/30' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{resp.vendor_name}</p>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{formatCurrency(resp.unit_price)}</span>
                    <span className="text-xs text-muted-foreground">per unit</span>
                    {isLowest && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Lowest</span>}
                  </div>
                  {resp.lead_time_days !== null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>{resp.lead_time_days} days</span>
                      {isFastest && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Fastest</span>}
                    </div>
                  )}
                  {resp.min_order_qty && <p className="text-xs text-muted-foreground">Min Qty: {resp.min_order_qty}</p>}
                  {resp.validity_date && <p className="text-xs text-muted-foreground">Valid until: {format(new Date(resp.validity_date), 'd MMM yyyy')}</p>}
                  {resp.notes && <p className="text-xs text-muted-foreground">{resp.notes}</p>}
                </div>

                {resp.quote_document_url && (
                  <a
                    href={resp.quote_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Quote
                  </a>
                )}

                {!done && request.status !== 'closed' && (
                  <Button
                    size="sm"
                    onClick={() => setConfirmResp(resp)}
                    disabled={!!selecting}
                    className="mt-auto bg-[#e94560] hover:bg-[#c73652]"
                  >
                    Select Winner
                  </Button>
                )}

                {isSelected && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 text-center">✓ Selected</span>
                )}
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
