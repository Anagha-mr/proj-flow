"use client"

import { useState } from "react"
import { FileText, Image, File, FileImage, Download, Share2, Upload, History, Archive, ArchiveRestore, Trash2, MoreVertical, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatDistanceToNow, format } from "date-fns"
import type { DocumentRecord, AccessLevel } from "@/app/actions/documents"
import { archiveDocument, unarchiveDocument, deleteDocument, updateDocumentAccess } from "@/app/actions/documents"
import { useToast } from "@/hooks/use-toast"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileIcon(fileType: string) {
  const t = fileType.toLowerCase()
  if (t.includes("image") || t.includes("jpg") || t.includes("jpeg") || t.includes("png") || t.includes("gif") || t.includes("webp")) {
    return <Image className="w-8 h-8 text-blue-500" />
  }
  if (t.includes("dwg") || t.includes("dxf") || t.includes("skp") || t.includes("cad")) {
    return <FileImage className="w-8 h-8 text-orange-500" />
  }
  if (t.includes("pdf") || t.includes("doc") || t.includes("txt") || t.includes("sheet") || t.includes("excel") || t.includes("xls") || t.includes("xlsx")) {
    return <FileText className="w-8 h-8 text-red-500" />
  }
  return <File className="w-8 h-8 text-muted-foreground" />
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const VERSION_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  latest_issued: { label: "Latest", className: "bg-green-100 text-green-700" },
  superseded:    { label: "Superseded", className: "bg-amber-100 text-amber-700" },
  archived:      { label: "Archived", className: "bg-gray-100 text-gray-500" },
}

const ACCESS_LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  internal:             { label: "Internal", className: "bg-slate-100 text-slate-600" },
  client_visible:       { label: "Client", className: "bg-blue-100 text-blue-700" },
  contractor_visible:   { label: "Contractor", className: "bg-orange-100 text-orange-700" },
  public:               { label: "Public", className: "bg-green-100 text-green-700" },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentCardProps {
  document: DocumentRecord
  userRole: string
  onUploadVersion: (doc: DocumentRecord) => void
  onViewHistory: (doc: DocumentRecord) => void
  onShare: (doc: DocumentRecord) => void
  onRefresh: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentCard({
  document: doc,
  userRole,
  onUploadVersion,
  onViewHistory,
  onShare,
  onRefresh,
}: DocumentCardProps) {
  const { toast } = useToast()
  const [hovered, setHovered] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)

  const canUpload = userRole !== "intern"
  const canArchive = userRole === "owner" || userRole === "senior_designer"
  const canDelete = userRole === "owner" && doc.version_status !== "latest_issued"
  const canManageAccess = userRole === "owner" || userRole === "senior_designer"

  const versionBadge = VERSION_STATUS_BADGE[doc.version_status] ?? VERSION_STATUS_BADGE.latest_issued
  const accessBadge = ACCESS_LEVEL_BADGE[doc.access_level] ?? ACCESS_LEVEL_BADGE.internal

  async function handleArchive() {
    try {
      await archiveDocument(doc.id)
      toast({ title: "Document archived" })
      setArchiveDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    }
  }

  async function handleUnarchive() {
    try {
      await unarchiveDocument(doc.id)
      toast({ title: "Document unarchived" })
      setUnarchiveDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    }
  }

  async function handleDelete() {
    try {
      await deleteDocument(doc.id)
      toast({ title: "Document deleted" })
      setDeleteDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    }
  }

  async function handleAccessChange(level: AccessLevel) {
    setAccessLoading(true)
    try {
      await updateDocumentAccess(doc.id, level)
      toast({ title: "Access level updated" })
      onRefresh()
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    } finally {
      setAccessLoading(false)
    }
  }

  const actionRow = (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs px-2"
        onClick={() => window.open(doc.file_url, "_blank")}
      >
        <Download className="w-3 h-3 mr-1" /> Download
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs px-2"
        onClick={() => onShare(doc)}
      >
        <Share2 className="w-3 h-3 mr-1" /> Share
      </Button>
      {canUpload && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={() => onUploadVersion(doc)}
        >
          <Upload className="w-3 h-3 mr-1" /> New Version
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs px-2"
        onClick={() => onViewHistory(doc)}
      >
        <History className="w-3 h-3 mr-1" /> History
      </Button>
      {canArchive && doc.version_status !== "archived" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
          onClick={() => setArchiveDialogOpen(true)}
        >
          <Archive className="w-3 h-3 mr-1" /> Archive
        </Button>
      )}
      {canArchive && doc.version_status === "archived" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2 text-emerald-600 hover:text-emerald-700"
          onClick={() => setUnarchiveDialogOpen(true)}
        >
          <ArchiveRestore className="w-3 h-3 mr-1" /> Unarchive
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2 text-destructive hover:text-destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="w-3 h-3 mr-1" /> Delete
        </Button>
      )}
      {canManageAccess && (
        <Select
          value={doc.access_level}
          onValueChange={(v) => handleAccessChange(v as AccessLevel)}
          disabled={accessLoading}
        >
          <SelectTrigger className="h-7 text-xs w-auto px-2 gap-1 border-dashed">
            <SelectValue />
            <ChevronDown className="w-3 h-3" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="client_visible">Client Visible</SelectItem>
            <SelectItem value="contractor_visible">Contractor Visible</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )

  return (
    <>
      <div
        className="relative bg-card border rounded-lg p-4 flex flex-col gap-2 transition-shadow hover:shadow-md"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Mobile 3-dot menu */}
        <div className="absolute top-3 right-3 sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(doc.file_url, "_blank")}>
                <Download className="w-4 h-4 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare(doc)}>
                <Share2 className="w-4 h-4 mr-2" /> Share
              </DropdownMenuItem>
              {canUpload && (
                <DropdownMenuItem onClick={() => onUploadVersion(doc)}>
                  <Upload className="w-4 h-4 mr-2" /> New Version
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onViewHistory(doc)}>
                <History className="w-4 h-4 mr-2" /> Version History
              </DropdownMenuItem>
              {canArchive && doc.version_status !== "archived" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-amber-600"
                    onClick={() => setArchiveDialogOpen(true)}
                  >
                    <Archive className="w-4 h-4 mr-2" /> Archive
                  </DropdownMenuItem>
                </>
              )}
              {canArchive && doc.version_status === "archived" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-emerald-600"
                    onClick={() => setUnarchiveDialogOpen(true)}
                  >
                    <ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* File icon + name + version */}
        <div className="flex items-start gap-3 pr-8 sm:pr-0">
          <div className="shrink-0 mt-0.5">{getFileIcon(doc.file_type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug truncate">{doc.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${versionBadge.className}`}>
                v{doc.version_number} — {versionBadge.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accessBadge.className}`}>
                {accessBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
          {doc.uploader && <span>{doc.uploader.name}</span>}
          {doc.uploader && <span>·</span>}
          <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
          {doc.file_size_bytes && (
            <>
              <span>·</span>
              <span>{formatBytes(doc.file_size_bytes)}</span>
            </>
          )}
        </div>

        {/* Desktop hover action row */}
        <div className={`hidden sm:block transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {actionRow}
        </div>

        {/* Mobile action row always visible */}
        <div className="sm:hidden">
          {actionRow}
        </div>
      </div>

      {/* Archive confirm */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Archive &ldquo;{doc.name}&rdquo;? The file will be hidden from the default view but never deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unarchive confirm */}
      <Dialog open={unarchiveDialogOpen} onOpenChange={setUnarchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unarchive Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restore &ldquo;{doc.name}&rdquo; (v{doc.version_number}) from the archive? It will return to Latest Issued
            if it was the newest version, or Superseded otherwise.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnarchiveDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleUnarchive}>Unarchive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete &ldquo;{doc.name}&rdquo; (v{doc.version_number})? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
