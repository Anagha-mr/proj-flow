"use client"

import { useRef, useState } from "react"
import { format } from "date-fns"
import { ClipboardList, PenLine, X, ChevronDown } from "lucide-react"
import { PDFAnnotationViewer } from "@/components/rfi/pdf-annotation-viewer"
import type { PDFAnnotationViewerRef } from "@/components/rfi/pdf-annotation-viewer"
import type { RFIWithAnnotations } from "@/app/actions/rfis"

interface ProjectOption {
  id: string
  name: string
}

interface DocumentOption {
  id: string
  name: string
  file_url: string
  version: number
}

interface ContractorRfiSectionProps {
  contractorToken: string
  initialRfis: RFIWithAnnotations[]
  projects: ProjectOption[]
}

const STATUS_BADGE: Record<string, { label: string; dot: string }> = {
  open:      { label: "Open",      dot: "bg-blue-500" },
  escalated: { label: "Escalated", dot: "bg-red-500" },
  responded: { label: "Responded", dot: "bg-green-500" },
  closed:    { label: "Closed",    dot: "bg-gray-400" },
}

export function ContractorRfiSection({
  contractorToken,
  initialRfis,
  projects,
}: ContractorRfiSectionProps) {
  const viewerRef = useRef<PDFAnnotationViewerRef>(null)

  const [rfis, setRfis] = useState<RFIWithAnnotations[]>(initialRfis)
  const [showNewQuery, setShowNewQuery] = useState(false)
  const [viewRfi, setViewRfi] = useState<RFIWithAnnotations | null>(null)

  // New query form state
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [documents, setDocuments] = useState<DocumentOption[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState("")
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [spaceTag, setSpaceTag] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [annotationError, setAnnotationError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")

  async function handleProjectSelect(projectId: string) {
    setSelectedProjectId(projectId)
    setSelectedDocId("")
    setSelectedDoc(null)
    setDocuments([])
    setAnnotationError("")

    if (!projectId) return

    setDocsLoading(true)
    try {
      const { getProjectDocumentsForRFI } = await import("@/app/actions/rfis")
      const docs = await getProjectDocumentsForRFI(projectId)
      setDocuments(docs)
    } catch {
      setDocuments([])
    } finally {
      setDocsLoading(false)
    }
  }

  function handleDocSelect(docId: string) {
    const doc = documents.find((d) => d.id === docId) ?? null
    setSelectedDocId(docId)
    setSelectedDoc(doc)
    setAnnotationError("")
  }

  function resetForm() {
    setSelectedProjectId("")
    setDocuments([])
    setSelectedDocId("")
    setSelectedDoc(null)
    setTitle("")
    setDescription("")
    setSpaceTag("")
    setAnnotationError("")
    setSubmitError("")
    setSubmitSuccess("")
  }

  async function handleSubmit() {
    setSubmitError("")

    if (!selectedProjectId) { setSubmitError("Please select a project"); return }
    if (!selectedDocId) { setSubmitError("Please select a drawing"); return }
    if (!title.trim()) { setSubmitError("Please enter a title for your query"); return }

    if (!viewerRef.current) return
    const annotationData = viewerRef.current.getAnnotationData()
    if (annotationData.shapes.length === 0) {
      setAnnotationError("Please mark the area you're querying on the drawing")
      return
    }
    setAnnotationError("")
    setSubmitting(true)

    try {
      const res = await fetch("/api/rfi/contractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorToken,
          projectId: selectedProjectId,
          documentId: selectedDocId,
          title: title.trim(),
          description: description.trim(),
          annotationData,
          spaceTag: spaceTag.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to submit query")
        return
      }

      setSubmitSuccess(`Query ${data.refNumber} submitted successfully!`)

      // Reload RFIs for this project
      try {
        const { getContractorRFIs } = await import("@/app/actions/rfis")
        const updated = await getContractorRFIs(contractorToken, selectedProjectId)
        setRfis((prev) => {
          const otherRfis = prev.filter((r) => r.project_id !== selectedProjectId)
          return [...updated, ...otherRfis]
        })
      } catch {
        // non-critical
      }

      setTimeout(() => {
        setShowNewQuery(false)
        resetForm()
      }, 1800)
    } catch (err) {
      setSubmitError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Drawing Queries (RFIs)</h2>
        <button
          onClick={() => { setShowNewQuery(true); setViewRfi(null) }}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#e94560] text-white font-medium hover:bg-[#d63850] transition-colors"
        >
          <PenLine size={14} />
          New Query
        </button>
      </div>

      {/* RFI list */}
      {rfis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500">No drawing queries yet. Raise a query by tapping &quot;New Query&quot;.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rfis.map((rfi) => {
            const meta = STATUS_BADGE[rfi.status] ?? STATUS_BADGE.open
            return (
              <button
                key={rfi.id}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors"
                onClick={() => { setViewRfi(rfi); setShowNewQuery(false) }}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{rfi.ref_number}</span>
                    <span className="flex items-center gap-1 text-xs font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{rfi.title}</p>
                  {rfi.created_at && (
                    <p className="text-xs text-gray-400">{format(new Date(rfi.created_at), "d MMM yyyy")}</p>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* ── New Query full-screen overlay ──────────────────────────────────── */}
      {showNewQuery && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Raise a Drawing Query</h2>
              <button
                onClick={() => { setShowNewQuery(false); resetForm() }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {/* Project selector */}
              {projects.length > 1 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]"
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drawing selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Drawing *</label>
                {docsLoading ? (
                  <div className="h-10 rounded-md bg-gray-100 animate-pulse" />
                ) : documents.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {selectedProjectId ? "No drawings available for this project." : "Select a project first."}
                  </p>
                ) : (
                  <select
                    value={selectedDocId}
                    onChange={(e) => handleDocSelect(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]"
                  >
                    <option value="">Select drawing…</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} (v{d.version})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Annotation canvas */}
              {selectedDoc && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mark the area *</label>
                  <PDFAnnotationViewer
                    ref={viewerRef}
                    fileUrl={selectedDoc.file_url}
                    mode="annotate"
                    height={420}
                  />
                  {annotationError && (
                    <p className="text-sm text-red-600 mt-1">{annotationError}</p>
                  )}
                </div>
              )}

              {/* Query title */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">What&apos;s your question? *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Which direction do the tiles run?"
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">More details (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any additional context for the designer…"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560] resize-none"
                />
              </div>

              {/* Space tag */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Space / Area (optional)</label>
                <input
                  type="text"
                  value={spaceTag}
                  onChange={(e) => setSpaceTag(e.target.value)}
                  placeholder="e.g. Master Bedroom, Kitchen"
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e94560]"
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{submitError}</p>
              )}
              {submitSuccess && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{submitSuccess}</p>
              )}

              {/* Submit button — full width, 48px, thumb-friendly */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !!submitSuccess}
                className="w-full h-12 rounded-lg bg-[#e94560] text-white font-semibold text-base disabled:opacity-60 hover:bg-[#d63850] transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Query"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View RFI response overlay ──────────────────────────────────────── */}
      {viewRfi && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{viewRfi.ref_number}</span>
                <h2 className="text-base font-semibold text-gray-900 mt-1">{viewRfi.title}</h2>
              </div>
              <button
                onClick={() => setViewRfi(null)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Contractor annotation (red, locked) */}
              {viewRfi.document?.file_url && viewRfi.annotation_data && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Query</h3>
                  <PDFAnnotationViewer
                    fileUrl={viewRfi.document.file_url}
                    mode="view"
                    existingAnnotation={viewRfi.annotation_data}
                    height={350}
                  />
                </div>
              )}

              {/* Designer response */}
              {(viewRfi.status === "responded" || viewRfi.status === "closed") ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Designer Response</h3>
                  {viewRfi.response_text && (
                    <blockquote className="border-l-4 border-green-400 pl-4 py-2 bg-green-50 rounded-r-lg mb-3">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{viewRfi.response_text}</p>
                      {viewRfi.responded_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(viewRfi.responded_at), "d MMM yyyy, h:mm a")}
                        </p>
                      )}
                    </blockquote>
                  )}
                  {viewRfi.document?.file_url && viewRfi.response_annotation_data && (
                    <PDFAnnotationViewer
                      fileUrl={viewRfi.document.file_url}
                      mode="view"
                      existingAnnotation={viewRfi.response_annotation_data}
                      height={350}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">Awaiting response from the design team.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
