"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QuoteRequest } from "@/app/actions/quotes"
import type { Vendor } from "@/app/actions/vendors"
import { getQuoteRequests } from "@/app/actions/quotes"
import { QuoteRequestSheet } from "./quote-request-sheet"
import { QuoteComparisonPanel } from "./quote-comparison-panel"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  sent:               { label: 'Sent',               className: 'bg-blue-100 text-blue-700' },
  partially_responded:{ label: 'Partial Response',   className: 'bg-amber-100 text-amber-700' },
  fully_responded:    { label: 'Fully Responded',    className: 'bg-green-100 text-green-700' },
  closed:             { label: 'Closed',             className: 'bg-gray-100 text-gray-500' },
}

interface QuotesTabProps {
  projectId: string
  initialRequests: QuoteRequest[]
  vendors: Vendor[]
}

interface ProcurementItemOption {
  id: string
  name: string
  curation_status: string | null
}

export function QuotesTab({ projectId, initialRequests, vendors }: QuotesTabProps) {
  const [requests, setRequests] = useState<QuoteRequest[]>(initialRequests)
  const [requestOpen, setRequestOpen] = useState(false)
  const [comparisonRequest, setComparisonRequest] = useState<QuoteRequest | null>(null)
  const [items, setItems] = useState<ProcurementItemOption[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function loadItems() {
      const { data: itemRows } = await supabase
        .from("procurement_items")
        .select("id, name")
        .eq("project_id", projectId)

      if (!itemRows || itemRows.length === 0) { setItems([]); return }

      const itemIds = itemRows.map((i) => i.id)
      const { data: statuses } = await supabase
        .from("procurement_item_status")
        .select("item_id, curation_status")
        .in("item_id", itemIds)
      const statusMap = Object.fromEntries((statuses ?? []).map((s) => [s.item_id, s.curation_status]))

      setItems(itemRows.map((i) => ({ id: i.id, name: i.name, curation_status: statusMap[i.id] ?? null })))
    }
    loadItems()
  }, [projectId])

  async function handleCreated() {
    try {
      const updated = await getQuoteRequests(projectId)
      setRequests(updated)
    } catch { /* silent */ }
  }

  async function handleWinnerSelected() {
    try {
      const updated = await getQuoteRequests(projectId)
      setRequests(updated)
    } catch { /* silent */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Quote Requests</h3>
        <Button size="sm" onClick={() => setRequestOpen(true)} className="bg-[#e94560] hover:bg-[#c73652]">
          <Plus className="w-4 h-4 mr-1" /> Request Quote
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="flex items-center justify-center h-40 border border-dashed rounded-xl text-sm text-muted-foreground text-center px-4">
          No quote requests yet. Set a procurement item&apos;s curation status to &apos;Quoting&apos; and use + Request Quote.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="pb-2 pr-4">Item Name</th>
                <th className="pb-2 pr-4">Vendors Invited</th>
                <th className="pb-2 pr-4">Responses</th>
                <th className="pb-2 pr-4">Deadline</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const badge = STATUS_BADGE[req.status] ?? STATUS_BADGE.sent
                return (
                  <tr key={req.id} className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => setComparisonRequest(req)}>
                    <td className="py-2.5 pr-4 font-medium">{req.item_name ?? '—'}</td>
                    <td className="py-2.5 pr-4">{(req.vendor_ids ?? []).length}</td>
                    <td className="py-2.5 pr-4">{req.response_count ?? 0} / {(req.vendor_ids ?? []).length}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {req.response_deadline ? format(new Date(req.response_deadline), 'd MMM yyyy') : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-muted rounded"><MoreHorizontal className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setComparisonRequest(req)}>View Responses</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <QuoteRequestSheet
        open={requestOpen}
        onOpenChange={setRequestOpen}
        projectId={projectId}
        items={items}
        vendors={vendors}
        onCreated={handleCreated}
      />

      <QuoteComparisonPanel
        request={comparisonRequest}
        onClose={() => setComparisonRequest(null)}
        onWinnerSelected={handleWinnerSelected}
      />
    </div>
  )
}
