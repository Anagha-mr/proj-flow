"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Check, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { shareMoodboardWithClient } from "@/app/actions/moodboards"
import type { Moodboard } from "@/app/actions/moodboards"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  moodboard: Moodboard
  onShared: (m: Moodboard) => void
  studioHasWhatsapp?: boolean
  clientName?: string
}

export function MoodboardSharePanel({
  open,
  onOpenChange,
  moodboard,
  onShared,
  studioHasWhatsapp = false,
  clientName = "the client",
}: Props) {
  const { toast } = useToast()
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/moodboard/${moodboard.share_token}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Could not copy to clipboard", variant: "destructive" })
    }
  }

  async function handleShare() {
    setSharing(true)
    try {
      const updated = await shareMoodboardWithClient(moodboard.id)
      toast({ title: "Moodboard shared. Client notified via WhatsApp." })
      onShared(updated)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Share Moodboard with Client</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-6">
          <p className="font-semibold text-gray-900">{moodboard.title}</p>

          {/* Thumbnail preview */}
          {moodboard.thumbnail_url && (
            <div className="aspect-video rounded-lg overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={moodboard.thumbnail_url}
                alt={moodboard.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Share link */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Share Link
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 border rounded-lg px-3 py-2 bg-gray-50 text-xs text-gray-700 truncate">
                {shareUrl}
              </div>
              <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* WhatsApp preview */}
          {studioHasWhatsapp ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview Message
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-700 italic">
                {`"Hi ${clientName}, your moodboard '${moodboard.title}' is ready for review. View it here: ${shareUrl}"`}
              </div>
              <p className="text-xs text-muted-foreground">
                This will also send a WhatsApp notification to the client.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                WhatsApp not configured. The link will be available to copy but no notification will
                be sent. Configure WhatsApp in{" "}
                <a href="/dashboard/settings" className="text-[#e94560] hover:underline">
                  Settings → Integrations
                </a>
                .
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleShare}
              disabled={sharing}
              className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white w-full"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Share with Client
            </Button>
            <Button variant="outline" onClick={handleCopy} className="w-full gap-2">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              Copy Link Only
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
