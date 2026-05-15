"use client"

import { useState } from "react"
import { format, isPast } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { respondToRfi, updateRfiStatus } from "@/app/actions/rfis"
import type { RFI } from "@/app/actions/rfis"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:         { label: "Open",         className: "bg-blue-100 text-blue-700" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-700" },
  responded:    { label: "Responded",    className: "bg-green-100 text-green-700" },
  closed:       { label: "Closed",       className: "bg-slate-100 text-slate-600" },
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open:         ["under_review", "closed"],
  under_review: ["responded"],
  responded:    ["closed"],
  closed:       [],
}

interface RfiDetailSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  rfi: RFI
  canManage: boolean
  onUpdated: (rfi: RFI) => void
}

export function RfiDetailSheet({ open, onOpenChange, rfi: initialRfi, canManage, onUpdated }: RfiDetailSheetProps) {
  const { toast } = useToast()
  const [rfi, setRfi] = useState(initialRfi)
  const [responseText, setResponseText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const statusMeta = STATUS_BADGE[rfi.status] ?? STATUS_BADGE.open
  const deadline = new Date(rfi.response_deadline)
  const isOverdue = isPast(deadline) && rfi.status !== 'responded' && rfi.status !== 'closed'
  const allowedTransitions = VALID_TRANSITIONS[rfi.status] ?? []
  const canRespond = canManage && (rfi.status === 'open' || rfi.status === 'under_review')

  async function handleRespond() {
    if (!responseText.trim()) {
      toast({ title: "Response text is required", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      await respondToRfi(rfi.id, responseText.trim())
      const updated = { ...rfi, status: 'responded' as RFI['status'], response_text: responseText.trim() }
      setRfi(updated)
      onUpdated(updated)
      toast({ title: "Response submitted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true)
    try {
      await updateRfiStatus(rfi.id, newStatus as RFI['status'])
      const updated = { ...rfi, status: newStatus as RFI['status'] }
      setRfi(updated)
      onUpdated(updated)
      toast({ title: `Status updated to ${newStatus.replace("_", " ")}` })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto flex flex-col">
        <SheetHeader className="pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{rfi.ref_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
            {isOverdue && (
              <span className="flex items-center gap-1 bg-red-100 text-red-700 font-semibold text-xs px-2 py-0.5 rounded">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                OVERDUE
              </span>
            )}
          </div>
          <SheetTitle className="text-base mt-1">{rfi.title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto">
          {/* RFI Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Raised by</dt>
              <dd className="font-medium capitalize">{rfi.raised_by_type}</dd>
              {rfi.contractor && (
                <>
                  <dt className="text-muted-foreground">Contractor</dt>
                  <dd className="font-medium">{rfi.contractor.company_name}</dd>
                </>
              )}
              {rfi.space_tag && (
                <>
                  <dt className="text-muted-foreground">Space</dt>
                  <dd className="font-medium">{rfi.space_tag}</dd>
                </>
              )}
              {rfi.linked_document && (
                <>
                  <dt className="text-muted-foreground">Linked Document</dt>
                  <dd><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">📄 {rfi.linked_document.name}</span></dd>
                </>
              )}
            </dl>
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{rfi.description}</p>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-muted-foreground w-32 shrink-0">Raised at</span>
                <span>{format(new Date(rfi.created_at), "d MMM yyyy, h:mm a")}</span>
              </div>
              <div className="flex gap-3">
                <span className={`w-32 shrink-0 ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>Deadline</span>
                <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                  {format(deadline, "d MMM yyyy, h:mm a")}
                  {isOverdue ? " — OVERDUE" : ""}
                </span>
              </div>
              {rfi.responded_at && (
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-32 shrink-0">Responded at</span>
                  <span>{format(new Date(rfi.responded_at), "d MMM yyyy, h:mm a")}</span>
                </div>
              )}
              {rfi.escalated_at && (
                <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Escalated on {format(new Date(rfi.escalated_at), "d MMM yyyy, h:mm a")}
                </div>
              )}
            </div>
          </section>

          {/* Response */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Response</h3>
            {rfi.response_text && (
              <blockquote className="border-l-4 border-green-400 pl-4 py-2 bg-green-50 rounded-r-lg mb-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{rfi.response_text}</p>
                {rfi.responder && (
                  <p className="text-xs text-muted-foreground mt-1">— {rfi.responder.name}</p>
                )}
              </blockquote>
            )}
            {canRespond && !rfi.response_text && (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response…"
                  rows={4}
                  className="focus-visible:ring-[#e94560]"
                />
                <Button onClick={handleRespond} disabled={submitting || !responseText.trim()} className="self-start bg-[#e94560] hover:bg-[#d63850] text-white">
                  {submitting ? "Submitting…" : "Submit Response"}
                </Button>
              </div>
            )}
          </section>

          {/* Status controls */}
          {allowedTransitions.length > 0 && canManage && (
            <section className="pb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Change Status</h3>
              <Select onValueChange={handleStatusChange} disabled={changingStatus} value="">
                <SelectTrigger className="w-48 focus:ring-[#e94560]">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
