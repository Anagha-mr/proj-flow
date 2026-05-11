"use client"

import { useState, useEffect, useCallback } from "react"
import { Upload, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown, ChevronRight } from "lucide-react"
import { DocumentCard } from "./document-card"
import { UploadDocumentSheet } from "./upload-document-sheet"
import { UploadVersionSheet } from "./upload-version-sheet"
import { VersionHistoryPanel } from "./version-history-panel"
import { ShareDocumentPanel } from "./share-document-panel"
import { getDocumentsByCategory, type DocumentRecord, type DocumentCategory } from "@/app/actions/documents"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentsTabProps {
  projectId: string
  studioId: string
  projectMembers: Array<{ id: string; name: string; role: string }>
  userRole: string
  currentUserId: string
}

const ALL_CATEGORIES: DocumentCategory[] = [
  "Drawings",
  "Specifications",
  "Site Photos",
  "Contracts",
  "Reports",
  "Client Shared",
  "Contractor Shared",
]

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentsTab({
  projectId,
  studioId,
  userRole,
  currentUserId,
}: DocumentsTabProps) {
  const [grouped, setGrouped] = useState<Record<DocumentCategory, DocumentRecord[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "All">("All")
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Sheet/panel states
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionDoc, setVersionDoc] = useState<DocumentRecord | null>(null)
  const [historyDoc, setHistoryDoc] = useState<DocumentRecord | null>(null)
  const [shareDoc, setShareDoc] = useState<DocumentRecord | null>(null)

  const canUpload = userRole !== "intern"

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDocumentsByCategory(projectId)
      setGrouped(data)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  function toggleSection(category: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const totalCount = grouped
    ? Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!loading && totalCount === 0 && activeCategory === "All") {
    return (
      <div className="flex flex-col gap-0">
        <TopBar
          canUpload={canUpload}
          onUpload={() => setUploadOpen(true)}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          grouped={grouped}
        />
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">No documents yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload drawings, contracts, photos and more
            </p>
          </div>
          {canUpload && (
            <Button
              onClick={() => setUploadOpen(true)}
              className="bg-[#e94560] hover:bg-[#c73652] text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload First Document
            </Button>
          )}
        </div>

        <UploadDocumentSheet
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          projectId={projectId}
          studioId={studioId}
          onSuccess={load}
        />
      </div>
    )
  }

  // ─── Loading skeletons ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Main render ─────────────────────────────────────────────────────────────
  const categoriesToShow = activeCategory === "All" ? ALL_CATEGORIES : [activeCategory]

  return (
    <div className="flex flex-col gap-6">
      <TopBar
        canUpload={canUpload}
        onUpload={() => setUploadOpen(true)}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        grouped={grouped}
      />

      {activeCategory === "All" ? (
        // Grouped view
        <div className="flex flex-col gap-8">
          {categoriesToShow.map((category) => {
            const docs = grouped?.[category] ?? []
            const collapsed = collapsedSections.has(category)

            return (
              <div key={category}>
                {/* Section header */}
                <button
                  className="flex items-center gap-2 mb-4 w-full text-left"
                  onClick={() => toggleSection(category)}
                >
                  {collapsed
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {category}
                  </span>
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                    {docs.length}
                  </span>
                </button>

                {!collapsed && (
                  <CategoryGrid
                    category={category}
                    docs={docs}
                    userRole={userRole}
                    canUpload={canUpload}
                    onUpload={() => setUploadOpen(true)}
                    onUploadVersion={setVersionDoc}
                    onViewHistory={setHistoryDoc}
                    onShare={setShareDoc}
                    onRefresh={load}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // Flat filtered view
        <CategoryGrid
          category={activeCategory}
          docs={grouped?.[activeCategory] ?? []}
          userRole={userRole}
          canUpload={canUpload}
          onUpload={() => setUploadOpen(true)}
          onUploadVersion={setVersionDoc}
          onViewHistory={setHistoryDoc}
          onShare={setShareDoc}
          onRefresh={load}
        />
      )}

      {/* Sheets & Panels */}
      <UploadDocumentSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        studioId={studioId}
        onSuccess={load}
      />

      {versionDoc && (
        <UploadVersionSheet
          open={!!versionDoc}
          onOpenChange={(open) => !open && setVersionDoc(null)}
          document={versionDoc}
          studioId={studioId}
          onSuccess={() => { setVersionDoc(null); load() }}
        />
      )}

      {historyDoc && (
        <VersionHistoryPanel
          open={!!historyDoc}
          onOpenChange={(open) => !open && setHistoryDoc(null)}
          documentId={historyDoc.id}
          documentName={historyDoc.name}
        />
      )}

      {shareDoc && (
        <ShareDocumentPanel
          open={!!shareDoc}
          onOpenChange={(open) => !open && setShareDoc(null)}
          document={shareDoc}
          currentUserId={currentUserId}
          onRefresh={load}
        />
      )}
    </div>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({
  canUpload,
  onUpload,
  activeCategory,
  setActiveCategory,
  grouped,
}: {
  canUpload: boolean
  onUpload: () => void
  activeCategory: DocumentCategory | "All"
  setActiveCategory: (c: DocumentCategory | "All") => void
  grouped: Record<DocumentCategory, DocumentRecord[]> | null
}) {
  const filters: (DocumentCategory | "All")[] = [
    "All",
    "Drawings",
    "Specifications",
    "Site Photos",
    "Contracts",
    "Reports",
    "Client Shared",
    "Contractor Shared",
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Document Centre</h2>
        {canUpload && (
          <Button
            onClick={onUpload}
            className="bg-[#e94560] hover:bg-[#c73652] text-white shrink-0"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((cat) => {
          const count = cat === "All"
            ? (grouped ? Object.values(grouped).reduce((s, a) => s + a.length, 0) : 0)
            : (grouped?.[cat as DocumentCategory]?.length ?? 0)
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#e94560] text-white"
                  : "border border-[#e94560] text-[#e94560] hover:bg-[#e94560]/10"
              }`}
            >
              {cat} {count > 0 && <span className={`ml-1 text-xs ${active ? "opacity-80" : "opacity-60"}`}>({count})</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Category Grid ────────────────────────────────────────────────────────────

function CategoryGrid({
  category,
  docs,
  userRole,
  canUpload,
  onUpload,
  onUploadVersion,
  onViewHistory,
  onShare,
  onRefresh,
}: {
  category: DocumentCategory
  docs: DocumentRecord[]
  userRole: string
  canUpload: boolean
  onUpload: () => void
  onUploadVersion: (doc: DocumentRecord) => void
  onViewHistory: (doc: DocumentRecord) => void
  onShare: (doc: DocumentRecord) => void
  onRefresh: () => void
}) {
  if (docs.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Upload className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {canUpload ? (
            <button
              onClick={onUpload}
              className="text-[#e94560] hover:underline font-medium"
            >
              Upload {category}
            </button>
          ) : (
            `No ${category} uploaded yet`
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          userRole={userRole}
          onUploadVersion={onUploadVersion}
          onViewHistory={onViewHistory}
          onShare={onShare}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}
