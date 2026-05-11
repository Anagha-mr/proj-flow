"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Copy, Check } from "lucide-react"
import QRCode from "qrcode"
import {
  toggleScheduleShare,
  updateSchedule,
  type ProcurementSchedule,
} from "@/app/actions/procurement"
import { useToast } from "@/hooks/use-toast"

interface ScheduleSharePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ProcurementSchedule
  onRefresh: () => void
}

export function ScheduleSharePanel({
  open,
  onOpenChange,
  schedule,
  onRefresh,
}: ScheduleSharePanelProps) {
  const { toast } = useToast()
  const [shareEnabled, setShareEnabled] = useState(schedule.share_enabled)
  const [isClientPublished, setIsClientPublished] = useState(schedule.is_client_published)
  const [expiresAt, setExpiresAt] = useState(
    schedule.share_token_expires_at ? schedule.share_token_expires_at.slice(0, 10) : ""
  )
  const [shareToken, setShareToken] = useState(schedule.share_token)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // Client visibility toggles
  const [viewSupplier, setViewSupplier] = useState(schedule.client_can_view_supplier)
  const [viewBrand, setViewBrand] = useState(schedule.client_can_view_brand)
  const [viewPricing, setViewPricing] = useState(schedule.client_can_view_pricing)
  const [viewDetails, setViewDetails] = useState(schedule.client_can_view_details)
  const [canApprove, setCanApprove] = useState(schedule.client_can_approve)

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/procurement/${shareToken}`
    : `/share/procurement/${shareToken}`

  useEffect(() => {
    if (!shareEnabled) { setQrDataUrl(null); return }
    QRCode.toDataURL(shareUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [shareEnabled, shareUrl])

  async function handleShareToggle(enabled: boolean) {
    setSaving(true)
    try {
      const { shareToken: token } = await toggleScheduleShare(
        schedule.id,
        enabled,
        expiresAt || undefined
      )
      setShareToken(token)
      setShareEnabled(enabled)
      onRefresh()
    } catch {
      toast({ title: "Failed to update share settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handlePortalToggle(published: boolean) {
    setSaving(true)
    try {
      await updateSchedule(schedule.id, { is_client_published: published })
      setIsClientPublished(published)
      onRefresh()
    } catch {
      toast({ title: "Failed to update portal settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleAccessToggle(
    field: keyof Pick<ProcurementSchedule, 'client_can_view_supplier' | 'client_can_view_brand' | 'client_can_view_pricing' | 'client_can_view_details' | 'client_can_approve'>,
    value: boolean
  ) {
    try {
      await updateSchedule(schedule.id, { [field]: value })
      onRefresh()
    } catch {
      toast({ title: "Failed to update access setting", variant: "destructive" })
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Share Schedule</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-5 pb-6">
          {/* Publish to Client Portal */}
          <section>
            <p className="text-sm font-semibold mb-3">Publish to Client Portal</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Show on client portal</p>
                {isClientPublished ? (
                  <p className="text-xs text-green-600 mt-0.5">● Visible in client portal</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Not published to portal</p>
                )}
              </div>
              <Switch
                checked={isClientPublished}
                onCheckedChange={(v) => {
                  setIsClientPublished(v)
                  handlePortalToggle(v)
                }}
                disabled={saving}
              />
            </div>
          </section>

          <Separator />

          {/* External Share Link */}
          <section>
            <p className="text-sm font-semibold mb-3">External Share Link</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm">Enable share link</p>
                <p className="text-xs text-muted-foreground mt-0.5">Anyone with the link can view</p>
              </div>
              <Switch
                checked={shareEnabled}
                onCheckedChange={handleShareToggle}
                disabled={saving}
              />
            </div>

            {shareEnabled && (
              <>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-xs bg-muted"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="mb-3">
                  <label className="text-xs text-muted-foreground block mb-1">Expiry date (optional)</label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    onBlur={() => handleShareToggle(shareEnabled)}
                    className="text-sm focus-visible:ring-[#e94560]"
                  />
                </div>

                {qrDataUrl && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
                  </div>
                )}
              </>
            )}
          </section>

          <Separator />

          {/* Client Access Controls */}
          {(shareEnabled || isClientPublished) && (
            <section>
              <p className="text-sm font-semibold mb-3">Client Access Controls</p>
              <div className="flex flex-col gap-3">
                {[
                  { label: "View Supplier", field: "client_can_view_supplier" as const, value: viewSupplier, setter: setViewSupplier },
                  { label: "View Brand", field: "client_can_view_brand" as const, value: viewBrand, setter: setViewBrand },
                  { label: "View Pricing", field: "client_can_view_pricing" as const, value: viewPricing, setter: setViewPricing },
                  { label: "View Details", field: "client_can_view_details" as const, value: viewDetails, setter: setViewDetails },
                  { label: "Can Approve", field: "client_can_approve" as const, value: canApprove, setter: setCanApprove },
                ].map(({ label, field, value, setter }) => (
                  <div key={field} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{label}</p>
                      {field === "client_can_approve" && canApprove && (
                        <p className="text-xs text-green-600 mt-0.5">Client can approve/reject items</p>
                      )}
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(v) => {
                        setter(v)
                        handleAccessToggle(field, v)
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <Separator />

          {/* Share via */}
          <section>
            <p className="text-sm font-semibold mb-3">Share via</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!shareEnabled}>
                {copied ? <><Check className="w-3.5 h-3.5 mr-1 text-green-500" />Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1" />Copy Link</>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast({ title: "Excel export coming soon" })
                }}
              >
                Export Excel
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
