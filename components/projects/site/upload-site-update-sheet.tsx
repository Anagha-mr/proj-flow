"use client"

import { useState, useRef, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Upload, X, ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createSiteUpdate } from "@/app/actions/site"
import { useToast } from "@/hooks/use-toast"
import type { SiteUpdate } from "@/app/actions/site"

interface UploadSiteUpdateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  studioId: string
  onCreated: (update: SiteUpdate) => void
  existingSpaceTags: string[]
}

interface UploadFile {
  file: File
  preview: string
  progress: number
  url: string | null
  error: string | null
}

export function UploadSiteUpdateSheet({
  open,
  onOpenChange,
  projectId,
  studioId,
  onCreated,
  existingSpaceTags,
}: UploadSiteUpdateSheetProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadFile[]>([])
  const [spaceTag, setSpaceTag] = useState("")
  const [phaseTag, setPhaseTag] = useState<"before" | "during" | "after" | "">("")
  const [statusNote, setStatusNote] = useState("")
  const [isClientVisible, setIsClientVisible] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const uploadToStorage = useCallback(async (file: File, fileIndex: number) => {
    const supabase = createClient()
    const path = `${studioId}/${projectId}/site/${Date.now()}_${Math.random().toString(36).slice(2)}/${file.name}`

    setFiles((prev) =>
      prev.map((f, i) => i === fileIndex ? { ...f, progress: 10 } : f)
    )

    const { data, error } = await supabase.storage
      .from("project-files")
      .upload(path, file, { upsert: false })

    if (error) {
      console.error('STORAGE ERROR:', error)
      setFiles((prev) =>
        prev.map((f, i) => i === fileIndex ? { ...f, error: error.message, progress: 0 } : f)
      )
      return null
    }

    const { data: publicData } = supabase.storage
      .from("project-files")
      .getPublicUrl(data.path)

    const url = publicData.publicUrl

    setFiles((prev) =>
      prev.map((f, i) => i === fileIndex ? { ...f, url, progress: 100 } : f)
    )

    return url
  }, [studioId, projectId])

  const handleFiles = useCallback(async (rawFiles: FileList | null) => {
    if (!rawFiles) return
    const newEntries: UploadFile[] = Array.from(rawFiles).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      url: null,
      error: null,
    }))

    const startIdx = files.length
    setFiles((prev) => [...prev, ...newEntries])

    await Promise.all(
      newEntries.map((entry, i) => uploadToStorage(entry.file, startIdx + i))
    )
  }, [files.length, uploadToStorage])

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  const uploadedUrls = files.filter((f) => f.url).map((f) => f.url as string)
  const hasAllUploaded = files.length > 0 && files.every((f) => f.url)

  async function handleSubmit() {
    if (!hasAllUploaded) return
    setSubmitting(true)
    try {
      const newUpdate = await createSiteUpdate({
        projectId,
        photos: uploadedUrls,
        spaceTag: spaceTag || undefined,
        phaseTag: phaseTag || undefined,
        statusNote: statusNote || undefined,
        isClientVisible,
      })
      toast({ title: "Site update uploaded" })
      onCreated(newUpdate)
      onOpenChange(false)
      // Reset
      setFiles([])
      setSpaceTag("")
      setPhaseTag("")
      setStatusNote("")
      setIsClientVisible(false)
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Site Update</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          {/* Dropzone */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Photos <span className="text-red-500">*</span></label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? "border-[#e94560] bg-[#e94560]/5" : "border-[#1a1a2e]/30 hover:border-[#1a1a2e]/50"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Drag photos here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Thumbnail grid */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  {f.progress > 0 && f.progress < 100 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-10/12 bg-white/30 rounded-full h-1.5">
                        <div className="bg-white h-1.5 rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {f.error && (
                    <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                      <p className="text-white text-xs text-center px-1">{f.error}</p>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Space tag with datalist */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Space Tag (optional)</label>
            <Input
              value={spaceTag}
              onChange={(e) => setSpaceTag(e.target.value)}
              list="space-tag-suggestions"
              placeholder="e.g. Living Room, Kitchen"
              className="focus-visible:ring-[#e94560]"
            />
            <datalist id="space-tag-suggestions">
              {existingSpaceTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </div>

          {/* Phase */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Phase (optional)</label>
            <Select value={phaseTag} onValueChange={(v) => setPhaseTag(v as typeof phaseTag)}>
              <SelectTrigger className="focus:ring-[#e94560]">
                <SelectValue placeholder="Select phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="during">During</SelectItem>
                <SelectItem value="after">After</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status note */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Status Note (optional)</label>
            <Textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Brief description of work done..."
              rows={3}
              maxLength={500}
              className="focus-visible:ring-[#e94560] resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{statusNote.length}/500</p>
          </div>

          {/* Client visible toggle */}
          <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg p-3">
            <div>
              <Label htmlFor="client-visible" className="text-sm font-medium">Visible to client in portal</Label>
              <p className="text-xs text-gray-500 mt-0.5">Client can see this update in their portal</p>
            </div>
            <Switch
              id="client-visible"
              checked={isClientVisible}
              onCheckedChange={setIsClientVisible}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!hasAllUploaded || submitting}
            className="w-full bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
          >
            {submitting ? "Uploading…" : files.length === 0 ? "Add photos first" : "Upload Update"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
