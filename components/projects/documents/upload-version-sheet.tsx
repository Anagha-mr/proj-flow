"use client"

import { useState, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Upload, X, File, AlertTriangle } from "lucide-react"
import { uploadNewVersion, type DocumentRecord } from "@/app/actions/documents"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface UploadVersionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentRecord
  studioId: string
  onSuccess: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadVersionSheet({
  open,
  onOpenChange,
  document: doc,
  studioId,
  onSuccess,
}: UploadVersionSheetProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const newVersionNumber = doc.version_number + 1

  function reset() {
    setSelectedFile(null)
    setDescription("")
    setUploading(false)
    setProgress(0)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return

    setUploading(true)
    setProgress(10)

    try {
      const supabase = createClient()
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${studioId}/${doc.project_id}/documents/${doc.category}/v${newVersionNumber}/${Date.now()}_${safeName}`
      const ext = selectedFile.name.split(".").pop() ?? ""

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 8, 85))
      }, 300)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("projectflow-files")
        .upload(storagePath, selectedFile, { upsert: false })

      clearInterval(progressInterval)
      setProgress(90)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("projectflow-files")
        .getPublicUrl(uploadData.path)

      await uploadNewVersion({
        previousDocumentId: doc.id,
        fileUrl: publicUrl,
        fileType: selectedFile.type || ext,
        fileSizeBytes: selectedFile.size,
        description: description.trim() || undefined,
      })

      setProgress(100)
      toast({ title: `Version v${newVersionNumber} uploaded. Previous version archived.` })
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({ title: (err as Error).message ?? "Upload failed", variant: "destructive" })
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!uploading) { reset(); onOpenChange(v) } }}>
      <SheetContent side="right" className="w-full sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload New Version</SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium text-muted-foreground truncate">{doc.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
              v{doc.version_number} — Latest Issued
            </span>
          </div>
        </SheetHeader>

        {/* Warning banner */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Uploading a new version will automatically archive the current version (v{doc.version_number}). This cannot be undone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6">
          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Version Notes</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What changed in this version…"
              rows={3}
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* File dropzone */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">New File *</label>
            {selectedFile ? (
              <div className="border rounded-lg p-4 flex items-center gap-3">
                <File className="w-8 h-8 text-[#e94560] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging
                    ? "border-[#e94560] bg-[#e94560]/5"
                    : "border-[#e94560]/50 hover:border-[#e94560] hover:bg-[#e94560]/5"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-[#e94560]" />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#e94560]">Click to upload or drag &amp; drop</p>
                  <p className="text-xs text-muted-foreground mt-1">Will be saved as v{newVersionNumber}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
                />
              </div>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Uploading… {progress}%</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={uploading}
              onClick={() => { reset(); onOpenChange(false) }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#e94560] hover:bg-[#c73652] text-white"
              disabled={uploading || !selectedFile}
            >
              {uploading ? "Uploading…" : `Upload v${newVersionNumber}`}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
