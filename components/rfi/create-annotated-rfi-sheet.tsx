"use client"

import { useRef, useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createAnnotatedRFI, getProjectDocumentsForRFI } from "@/app/actions/rfis"
import { PDFAnnotationViewer } from "./pdf-annotation-viewer"
import type { PDFAnnotationViewerRef } from "./pdf-annotation-viewer"
import type { RFIWithAnnotations } from "@/app/actions/rfis"

interface ProjectMemberOption {
  id: string
  name: string
}

interface CreateAnnotatedRFISheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: { id: string; name: string }
  projectMembers: ProjectMemberOption[]
  onCreated: (rfi: RFIWithAnnotations) => void
}

interface DocumentOption {
  id: string
  name: string
  file_url: string
  version: number
}

export function CreateAnnotatedRFISheet({
  open,
  onOpenChange,
  project,
  projectMembers,
  onCreated,
}: CreateAnnotatedRFISheetProps) {
  const { toast } = useToast()
  const viewerRef = useRef<PDFAnnotationViewerRef>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [spaceTag, setSpaceTag] = useState("")
  const [assignedToId, setAssignedToId] = useState("")
  const [selectedDocId, setSelectedDocId] = useState("")
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption | null>(null)
  const [documents, setDocuments] = useState<DocumentOption[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [annotationError, setAnnotationError] = useState("")

  // Fetch documents when sheet opens
  useEffect(() => {
    if (!open) return
    setDocsLoading(true)
    getProjectDocumentsForRFI(project.id)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false))
  }, [open, project.id])

  function handleDocSelect(docId: string) {
    setSelectedDocId(docId)
    setSelectedDoc(documents.find((d) => d.id === docId) ?? null)
    setAnnotationError("")
  }

  function resetForm() {
    setTitle("")
    setDescription("")
    setSpaceTag("")
    setAssignedToId("")
    setSelectedDocId("")
    setSelectedDoc(null)
    setAnnotationError("")
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    if (!selectedDocId) {
      toast({ title: "Please select a drawing", variant: "destructive" })
      return
    }
    if (!assignedToId) {
      toast({ title: "Please select who this RFI is assigned to", variant: "destructive" })
      return
    }
    if (!viewerRef.current) return

    const annotationData = viewerRef.current.getAnnotationData()
    if (annotationData.shapes.length === 0) {
      setAnnotationError("Please mark the area you're querying on the drawing")
      return
    }
    setAnnotationError("")

    setSaving(true)
    try {
      const created = await createAnnotatedRFI({
        projectId: project.id,
        documentId: selectedDocId,
        title: title.trim(),
        description: description.trim(),
        annotationData,
        spaceTag: spaceTag.trim() || undefined,
        assignedToId,
      })
      onCreated(created)
      toast({ title: "RFI submitted" })
      onOpenChange(false)
      resetForm()
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <SheetContent side="right" className="w-full md:w-[680px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>New Annotated RFI</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4 flex-1">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the query"
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Drawing selector */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Drawing *</label>
            {docsLoading ? (
              <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No latest-issued drawings found for this project.
              </p>
            ) : (
              <Select value={selectedDocId} onValueChange={handleDocSelect}>
                <SelectTrigger className="focus:ring-[#e94560]">
                  <SelectValue placeholder="Select drawing…" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} <span className="text-muted-foreground ml-1">v{d.version}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Space tag */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Space / Area tag</label>
            <Input
              value={spaceTag}
              onChange={(e) => setSpaceTag(e.target.value)}
              placeholder="Kitchen / Living Room / etc."
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Assigned To */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assigned To *</label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue placeholder="Select team member…" />
              </SelectTrigger>
              <SelectContent>
                {projectMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context for your query…"
              rows={3}
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* PDF Annotation Viewer */}
          {selectedDoc && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Annotation
                </span>
                <span className="text-xs text-muted-foreground">
                  Draw on the area you&apos;re querying
                </span>
              </div>
              <PDFAnnotationViewer
                ref={viewerRef}
                fileUrl={selectedDoc.file_url}
                mode="annotate"
                height={500}
              />
              {annotationError && (
                <p className="text-sm text-red-600 mt-1.5">{annotationError}</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t mt-4 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { onOpenChange(false); resetForm() }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#e94560] hover:bg-[#d63850] text-white"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Submitting…" : "Submit RFI"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
