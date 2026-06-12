"use client"

import { useRef, useState } from "react"
import { format, isPast } from "date-fns"
import { AlertTriangle } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { respondToRFI, closeRFI } from "@/app/actions/rfis"
import { PDFAnnotationViewer } from "./pdf-annotation-viewer"
import type { PDFAnnotationViewerRef } from "./pdf-annotation-viewer"
import type { RFIWithAnnotations } from "@/app/actions/rfis"

const STATUS_BADGE: Record<string, { label: string; dot: string; className: string }> = {
  open:      { label: "Open",      dot: "bg-blue-500",   className: "bg-blue-100 text-blue-700" },
  escalated: { label: "Escalated", dot: "bg-red-500",    className: "bg-red-100 text-red-700" },
  responded: { label: "Responded", dot: "bg-green-500",  className: "bg-green-100 text-green-700" },
  closed:    { label: "Closed",    dot: "bg-gray-400",   className: "bg-slate-100 text-slate-600" },
}

interface RFIDetailPanelProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  rfi: RFIWithAnnotations
  onUpdated: (rfi: RFIWithAnnotations) => void
}

export function RFIDetailPanel({ open, onOpenChange, rfi: initialRfi, onUpdated }: RFIDetailPanelProps) {
  const { toast } = useToast()
  const respondViewerRef = useRef<PDFAnnotationViewerRef>(null)
  const [rfi, setRfi] = useState(initialRfi)
  const [responseText, setResponseText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)

  const statusMeta = STATUS_BADGE[rfi.status] ?? STATUS_BADGE.open
  const deadline = rfi.response_deadline ? new Date(rfi.response_deadline) : null
  const isOverdue = deadline
    ? isPast(deadline) && rfi.status !== "responded" && rfi.status !== "closed"
    : false

  const isOpen = rfi.status === "open" || rfi.status === "escalated"
  const isResponded = rfi.status === "responded"
  const isClosed = rfi.status === "closed"

  async function handleRespond() {
    if (!responseText.trim()) {
      toast({ title: "Response text is required", variant: "destructive" })
      return
    }
    const responseAnnotationData = respondViewerRef.current?.getAnnotationData()

    setSubmitting(true)
    try {
      await respondToRFI(rfi.id, {
        responseText: responseText.trim(),
        responseAnnotationData: responseAnnotationData?.shapes?.length
          ? responseAnnotationData
          : undefined,
      })
      const updated: RFIWithAnnotations = {
        ...rfi,
        status: "responded",
        response_text: responseText.trim(),
        response_annotation_data: responseAnnotationData?.shapes?.length
          ? responseAnnotationData
          : null,
      }
      setRfi(updated)
      onUpdated(updated)
      toast({ title: "Response submitted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose() {
    setClosing(true)
    try {
      await closeRFI(rfi.id)
      const updated: RFIWithAnnotations = { ...rfi, status: "closed" }
      setRfi(updated)
      onUpdated(updated)
      toast({ title: "RFI closed" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setClosing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full md:w-[680px] overflow-y-auto flex flex-col">
        <SheetHeader className="pb-3 border-b">
          {/* Ref + status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded">
              {rfi.ref_number}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusMeta.className}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            {rfi.raised_by_type === "contractor" && (
              <span className="text-xs text-muted-foreground">
                · Raised by contractor
              </span>
            )}
            {deadline && (
              <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                · {isOverdue ? "OVERDUE" : `Deadline ${format(deadline, "d MMM, h:mm a")}`}
              </span>
            )}
          </div>
          <SheetTitle className="text-base mt-1">{rfi.title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto pb-4">
          {/* Description */}
          {rfi.description && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{rfi.description}</p>
          )}

          {/* Metadata */}
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            {rfi.space_tag && (
              <>
                <dt className="text-muted-foreground">Space</dt>
                <dd className="font-medium">{rfi.space_tag}</dd>
              </>
            )}
            {rfi.contractor && (
              <>
                <dt className="text-muted-foreground">Contractor</dt>
                <dd className="font-medium">{rfi.contractor.company_name}</dd>
              </>
            )}
            {rfi.escalated_at && (
              <>
                <dt className="text-muted-foreground">Escalated</dt>
                <dd className="font-medium text-red-600">{format(new Date(rfi.escalated_at), "d MMM yyyy, h:mm a")}</dd>
              </>
            )}
          </dl>

          {/* Escalation alert */}
          {isOverdue && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Response deadline has passed — this RFI is overdue.
            </div>
          )}

          {/* ── Contractor's annotation ──────────────────────────────────── */}
          {rfi.document?.file_url && rfi.annotation_data && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Contractor&apos;s Annotation</h3>
              <PDFAnnotationViewer
                fileUrl={rfi.document.file_url}
                mode="view"
                existingAnnotation={rfi.annotation_data}
                height={400}
              />
            </section>
          )}

          {/* ── Designer Response section ────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Designer Response</h3>

            {/* Responded / closed state — read-only */}
            {(isResponded || isClosed) && (
              <div className="flex flex-col gap-3">
                {rfi.response_text && (
                  <blockquote className="border-l-4 border-green-400 pl-4 py-2 bg-green-50 rounded-r-lg">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{rfi.response_text}</p>
                    {rfi.responder && (
                      <p className="text-xs text-muted-foreground mt-1">— {rfi.responder.name}</p>
                    )}
                    {rfi.responded_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(rfi.responded_at), "d MMM yyyy, h:mm a")}
                      </p>
                    )}
                  </blockquote>
                )}

                {/* Response annotation (green, locked) */}
                {rfi.document?.file_url && rfi.response_annotation_data && (
                  <PDFAnnotationViewer
                    fileUrl={rfi.document.file_url}
                    mode="view"
                    existingAnnotation={rfi.response_annotation_data}
                    height={350}
                  />
                )}
              </div>
            )}

            {/* Open / escalated state — show response tools */}
            {isOpen && (
              <div className="flex flex-col gap-3">
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response…"
                  rows={3}
                  className="focus-visible:ring-[#1D9E75]"
                />

                {/* Respond-mode annotator — shows contractor markup + lets designer draw in green */}
                {rfi.document?.file_url && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Optionally mark up the drawing in response (green). Contractor markup shown in red.
                    </p>
                    <PDFAnnotationViewer
                      ref={respondViewerRef}
                      fileUrl={rfi.document.file_url}
                      mode="respond"
                      existingAnnotation={rfi.annotation_data}
                      height={420}
                    />
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Action buttons */}
        <div className="pt-4 border-t flex gap-3">
          {isOpen && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#1D9E75] hover:bg-[#178060] text-white"
                onClick={handleRespond}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Response"}
              </Button>
            </>
          )}

          {isResponded && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close Panel
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-slate-400 text-slate-600"
                onClick={handleClose}
                disabled={closing}
              >
                {closing ? "Closing…" : "Close RFI"}
              </Button>
            </>
          )}

          {isClosed && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close Panel
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
