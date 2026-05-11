"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { format } from "date-fns"
import { getVersionHistory, type DocumentRecord } from "@/app/actions/documents"

interface VersionHistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentName: string
}

const VERSION_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  latest_issued: { label: "Latest Issued", className: "bg-green-100 text-green-700" },
  superseded:    { label: "Superseded",    className: "bg-amber-100 text-amber-700" },
  archived:      { label: "Archived",      className: "bg-gray-100 text-gray-500" },
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  documentId,
  documentName,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getVersionHistory(documentId).then((data) => {
      setVersions(data)
      setLoading(false)
    })
  }, [open, documentId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="leading-snug">
            {documentName}
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">Version History</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="w-0.5 h-16 mt-1" />
                  </div>
                  <div className="flex-1 pb-6 flex flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No version history found.</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-3.5 top-3 bottom-0 border-l-2 border-muted" />

              <div className="flex flex-col gap-0">
                {versions.map((v, i) => {
                  const badge = VERSION_STATUS_BADGE[v.version_status] ?? VERSION_STATUS_BADGE.superseded
                  const isLatest = v.version_status === "latest_issued"
                  return (
                    <div key={v.id} className="relative flex gap-4 pb-6">
                      {/* Dot */}
                      <div
                        className={`shrink-0 w-4 h-4 rounded-full border-2 z-10 mt-0.5 ${
                          isLatest
                            ? "bg-[#e94560] border-[#e94560]"
                            : "bg-background border-muted-foreground/30"
                        }`}
                      />

                      {/* Content */}
                      <div
                        className={`flex-1 rounded-lg p-3 ${
                          isLatest ? "border-l-2 border-[#e94560] bg-[#e94560]/5 pl-3" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">v{v.version_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {v.uploader?.name ?? "Unknown"}
                          {" · "}
                          {format(new Date(v.created_at), "dd MMM yyyy, HH:mm")}
                        </p>
                        {v.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">{v.description}</p>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 mt-2 -ml-2"
                          onClick={() => window.open(v.file_url, "_blank")}
                        >
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
