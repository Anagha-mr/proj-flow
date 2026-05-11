"use client"

import { useState, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Upload, X, File } from "lucide-react"
import { createDocument, type DocumentCategory, type AccessLevel } from "@/app/actions/documents"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface UploadDocumentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  studioId: string
  onSuccess: () => void
}

const CATEGORIES: DocumentCategory[] = [
  "Drawings",
  "Specifications",
  "Site Photos",
  "Contracts",
  "Reports",
  "Client Shared",
  "Contractor Shared",
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadDocumentSheet({
  open,
  onOpenChange,
  projectId,
  studioId,
  onSuccess,
}: UploadDocumentSheetProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState<DocumentCategory | "">("")
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("internal")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  function reset() {
    setSelectedFile(null)
    setName("")
    setCategory("")
    setAccessLevel("internal")
    setDescription("")
    setTags("")
    setUploading(false)
    setProgress(0)
  }

  function handleFile(file: File) {
    setSelectedFile(file)
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ""))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !category || !name.trim()) return

    setUploading(true)
    setProgress(10)

    try {
      const supabase = createClient()
      const ext = selectedFile.name.split(".").pop() ?? ""
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${studioId}/${projectId}/documents/${category}/${Date.now()}_${safeName}`

      // Animate progress while uploading
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

      await createDocument({
        projectId,
        name: name.trim(),
        category: category as DocumentCategory,
        fileUrl: publicUrl,
        fileType: selectedFile.type || ext,
        fileSizeBytes: selectedFile.size,
        accessLevel,
        description: description.trim() || undefined,
        tags: tags.trim()
          ? tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      })

      setProgress(100)
      toast({ title: "Document uploaded successfully" })
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
          <SheetTitle>Upload Document</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6">
          {/* Document name */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Document Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Floor Plan v1"
              required
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Category *</label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)} required>
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Access level */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Access Level</label>
            <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as AccessLevel)}>
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal Only</SelectItem>
                <SelectItem value="client_visible">Client Visible</SelectItem>
                <SelectItem value="contractor_visible">Contractor Visible</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this document…"
              rows={3}
              className="focus-visible:ring-[#e94560]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. ground floor, electrical, approved"
              className="focus-visible:ring-[#e94560]"
            />
            <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
          </div>

          {/* File dropzone */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">File *</label>
            {selectedFile ? (
              <div className="border rounded-lg p-4 flex items-center gap-3">
                <File className="w-8 h-8 text-[#e94560] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)} · {selectedFile.type || "unknown type"}</p>
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
                  <p className="text-xs text-muted-foreground mt-1">All file types accepted</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
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
              disabled={uploading || !selectedFile || !category || !name.trim()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
