"use client"

import { useState, useEffect, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Copy, Check, Calendar, X } from "lucide-react"
import { format } from "date-fns"
import QRCode from "qrcode"
import {
  toggleShare,
  getDocumentAccessLog,
  type DocumentRecord,
  type DocumentAccessLog,
} from "@/app/actions/documents"
import { useToast } from "@/hooks/use-toast"

interface ShareDocumentPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentRecord
  currentUserId: string
  onRefresh: () => void
}

const ACCESS_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  studio_member: { label: "Team Member", className: "bg-slate-100 text-slate-600" },
  client:        { label: "Client",      className: "bg-blue-100 text-blue-700" },
  contractor:    { label: "Contractor",  className: "bg-orange-100 text-orange-700" },
  public:        { label: "Public",      className: "bg-green-100 text-green-700" },
}

export function ShareDocumentPanel({
  open,
  onOpenChange,
  document: doc,
  onRefresh,
}: ShareDocumentPanelProps) {
  const { toast } = useToast()
  const [shareEnabled, setShareEnabled] = useState(doc.share_enabled)
  const [shareToken] = useState(doc.share_token)
  const [expiresAt, setExpiresAt] = useState(
    doc.share_token_expires_at
      ? doc.share_token_expires_at.slice(0, 10)
      : ""
  )
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<DocumentAccessLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/document/${shareToken}`
    : `/share/document/${shareToken}`

  // Generate QR code whenever share is enabled
  useEffect(() => {
    if (!shareEnabled) { setQrDataUrl(null); return }
    QRCode.toDataURL(shareUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [shareEnabled, shareUrl])

  // Load access logs on open
  useEffect(() => {
    if (!open) return
    setLogsLoading(true)
    getDocumentAccessLog(doc.id)
      .then((data) => setLogs(data.slice(0, 10)))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  }, [open, doc.id])

  async function saveShareSettings(enabled: boolean, expires: string) {
    setSaving(true)
    try {
      await toggleShare(doc.id, enabled, expires || undefined)
      onRefresh()
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function handleToggle(enabled: boolean) {
    setShareEnabled(enabled)
    saveShareSettings(enabled, expiresAt)
  }

  function handleExpiryChange(value: string) {
    setExpiresAt(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveShareSettings(shareEnabled, value)
    }, 800)
  }

  function handleClearExpiry() {
    setExpiresAt("")
    saveShareSettings(shareEnabled, "")
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="leading-snug">
            {doc.name}
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">Share Document</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable sharing</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone with the link can download this document
              </p>
            </div>
            <Switch
              checked={shareEnabled}
              onCheckedChange={handleToggle}
              disabled={saving}
            />
          </div>

          {/* Share content */}
          {shareEnabled ? (
            <div className="flex flex-col gap-4">
              {/* Share URL */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Share Link</label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-xs font-mono bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR code for share link"
                    width={200}
                    height={200}
                    className="rounded-lg border"
                  />
                ) : (
                  <Skeleton className="w-[200px] h-[200px] rounded-lg" />
                )}
                <p className="text-xs text-muted-foreground">Scan to open document</p>
              </div>

              {/* Expiry */}
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Link expires on
                </label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => handleExpiryChange(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="focus-visible:ring-[#e94560]"
                  />
                  {expiresAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={handleClearExpiry}
                      title="Never expire"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {expiresAt ? `Expires ${format(new Date(expiresAt), "dd MMM yyyy")}` : "Never expires"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground text-center">
              Sharing is disabled. Enable the toggle to generate a shareable link.
            </div>
          )}

          <Separator />

          {/* Access log */}
          <div>
            <p className="text-sm font-semibold mb-3">Recent Access</p>
            {logsLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {logs.map((log) => {
                  const badge = ACCESS_TYPE_BADGE[log.accessed_by_type] ?? ACCESS_TYPE_BADGE.public
                  return (
                    <div key={log.id} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-muted-foreground">
                        {log.accessor_name ?? log.accessed_by_type}
                      </span>
                      <span className="text-muted-foreground/60 ml-auto shrink-0">
                        {format(new Date(log.accessed_at), "dd MMM, HH:mm")}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
