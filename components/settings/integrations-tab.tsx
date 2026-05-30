"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { updateStudioIntegrations, testWatiConnection, testResendEmail } from "@/app/actions/settings"
import { disconnectCanva } from "@/app/actions/canva"
import type { CanvaConnectionStatus } from "@/app/actions/canva"

interface IntegrationsTabProps {
  studioId: string
  initialWatiUrl: string | null
  initialWatiKey: string | null
  initialResendKey: string | null
  initialSendingEmail: string | null
  initialSendingEmailName: string | null
  canvaStatus?: CanvaConnectionStatus | null
  initialRazorpayKeyId?: string | null
  initialRazorpayKeySecret?: string | null
  initialRazorpayWebhookSecret?: string | null
  initialRazorpayPassFee?: boolean
}

export function IntegrationsTab({
  studioId,
  initialWatiUrl,
  initialWatiKey,
  initialResendKey,
  initialSendingEmail,
  initialSendingEmailName,
  canvaStatus,
  initialRazorpayKeyId,
  initialRazorpayKeySecret,
  initialRazorpayWebhookSecret,
  initialRazorpayPassFee = false,
}: IntegrationsTabProps) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  // WATI state
  const [watiUrl, setWatiUrl] = useState(initialWatiUrl ?? "")
  const [watiKey, setWatiKey] = useState(initialWatiKey ?? "")
  const [showWatiKey, setShowWatiKey] = useState(false)
  const [watiSaving, setWatiSaving] = useState(false)
  const [watiTesting, setWatiTesting] = useState(false)
  const [watiStatus, setWatiStatus] = useState<"connected" | "failed" | null>(
    initialWatiUrl && initialWatiKey ? "connected" : null
  )

  // Canva state
  const [canvaConnected, setCanvaConnected] = useState(canvaStatus?.connected ?? false)
  const [canvaExpired, setCanvaExpired] = useState(canvaStatus?.is_expired ?? false)
  const [canvaUserId, setCanvaUserId] = useState(canvaStatus?.canva_user_id ?? null)
  const [canvaConnecting, setCanvaConnecting] = useState(false)
  const [canvaDisconnecting, setCanvaDisconnecting] = useState(false)
  const [canvaDisconnectConfirm, setCanvaDisconnectConfirm] = useState(false)

  // Handle ?canva= query params on mount
  useEffect(() => {
    const canvaParam = searchParams.get("canva")
    if (canvaParam === "connected") {
      toast({ title: "Canva connected successfully." })
      setCanvaConnected(true)
      setCanvaExpired(false)
      const url = new URL(window.location.href)
      url.searchParams.delete("canva")
      router.replace(url.pathname + (url.search || ""))
    } else if (canvaParam === "error") {
      toast({ title: "Failed to connect Canva. Please try again.", variant: "destructive" })
      const url = new URL(window.location.href)
      url.searchParams.delete("canva")
      router.replace(url.pathname + (url.search || ""))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnectCanva() {
    setCanvaConnecting(true)
    try {
      const res = await fetch("/api/canva/auth")
      if (!res.ok) throw new Error("Failed to get auth URL")
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
      setCanvaConnecting(false)
    }
  }

  async function handleDisconnectCanva() {
    if (!canvaDisconnectConfirm) {
      setCanvaDisconnectConfirm(true)
      return
    }
    setCanvaDisconnecting(true)
    try {
      await disconnectCanva()
      setCanvaConnected(false)
      setCanvaExpired(false)
      setCanvaUserId(null)
      setCanvaDisconnectConfirm(false)
      toast({ title: "Canva disconnected" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setCanvaDisconnecting(false)
    }
  }

  // Resend state
  const [resendKey, setResendKey] = useState(initialResendKey ?? "")
  const [sendingEmail, setSendingEmail] = useState(initialSendingEmail ?? "")
  const [sendingEmailName, setSendingEmailName] = useState(initialSendingEmailName ?? "")
  const [showResendKey, setShowResendKey] = useState(false)
  const [resendSaving, setResendSaving] = useState(false)
  const [resendTesting, setResendTesting] = useState(false)
  const [resendStatus, setResendStatus] = useState<"connected" | "failed" | null>(
    initialResendKey && initialSendingEmail ? "connected" : null
  )

  // Razorpay state
  const [razorpayKeyId, setRazorpayKeyId] = useState(initialRazorpayKeyId ?? "")
  const [razorpayKeySecret, setRazorpayKeySecret] = useState(initialRazorpayKeySecret ?? "")
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState(initialRazorpayWebhookSecret ?? "")
  const [razorpayPassFee, setRazorpayPassFee] = useState(initialRazorpayPassFee)
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false)
  const [showRazorpayWebhookSecret, setShowRazorpayWebhookSecret] = useState(false)
  const [razorpaySaving, setRazorpaySaving] = useState(false)
  const [razorpayStatus, setRazorpayStatus] = useState<"connected" | "failed" | null>(
    initialRazorpayKeyId && initialRazorpayKeySecret ? "connected" : null
  )

  async function saveWati() {
    setWatiSaving(true)
    try {
      await updateStudioIntegrations({
        wati_api_url: watiUrl.trim() || null,
        wati_api_key: watiKey.trim() || null,
      })
      setWatiStatus(watiUrl.trim() && watiKey.trim() ? "connected" : null)
      toast({ title: "WhatsApp settings saved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setWatiSaving(false)
    }
  }

  async function handleTestWati() {
    setWatiTesting(true)
    try {
      const result = await testWatiConnection(studioId)
      setWatiStatus(result.ok ? "connected" : "failed")
      toast({
        title: result.ok ? "Connected" : "Connection failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setWatiTesting(false)
    }
  }

  async function saveResend() {
    setResendSaving(true)
    try {
      await updateStudioIntegrations({
        resend_api_key: resendKey.trim() || null,
        sending_email: sendingEmail.trim() || null,
        sending_email_name: sendingEmailName.trim() || null,
      })
      setResendStatus(resendKey.trim() && sendingEmail.trim() ? "connected" : null)
      toast({ title: "Email settings saved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setResendSaving(false)
    }
  }

  async function handleTestResend() {
    setResendTesting(true)
    try {
      const result = await testResendEmail(studioId)
      setResendStatus(result.ok ? "connected" : "failed")
      toast({
        title: result.ok ? "Test email sent" : "Email failed",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setResendTesting(false)
    }
  }

  async function saveRazorpay() {
    setRazorpaySaving(true)
    try {
      await updateStudioIntegrations({
        razorpay_key_id: razorpayKeyId.trim() || null,
        razorpay_key_secret: razorpayKeySecret.trim() || null,
        razorpay_webhook_secret: razorpayWebhookSecret.trim() || null,
        razorpay_pass_fee_to_client: razorpayPassFee,
      })
      setRazorpayStatus(razorpayKeyId.trim() && razorpayKeySecret.trim() ? "connected" : null)
      toast({ title: "Razorpay settings saved" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setRazorpaySaving(false)
    }
  }

  function StatusBadge({ status }: { status: "connected" | "failed" | null }) {
    if (!status) return null
    return status === "connected" ? (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Connected
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
        <XCircle className="w-3 h-3" /> Not connected
      </Badge>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Canva card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Canva logomark */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="6" fill="#7D2AE8"/>
                <path d="M16.5 8.5C16.5 8.5 14.5 6 12 6C8.96 6 6.5 8.46 6.5 11.5C6.5 14.54 8.96 17 12 17C14.5 17 16.5 14.5 16.5 14.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <CardTitle className="text-base font-semibold">Canva</CardTitle>
            </div>
            {canvaConnected && !canvaExpired && (
              <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </Badge>
            )}
            {canvaExpired && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                <AlertTriangle className="w-3 h-3" /> Token expired
              </Badge>
            )}
            {!canvaConnected && !canvaExpired && (
              <Badge className="bg-gray-100 text-gray-500 border-gray-200 gap-1">
                <XCircle className="w-3 h-3" /> Not connected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your Canva account to create and embed moodboards directly inside ProjectFlow.
          </p>
        </CardHeader>
        <CardContent>
          {canvaConnected && !canvaExpired && canvaUserId && (
            <p className="text-sm text-muted-foreground mb-3">
              <span className="text-green-600">●</span> Connected as{" "}
              <span className="font-medium">{canvaUserId}</span>
            </p>
          )}
          <div className="flex gap-2">
            {!canvaConnected || canvaExpired ? (
              <Button
                onClick={handleConnectCanva}
                disabled={canvaConnecting}
                className="bg-[#7D2AE8] hover:bg-[#6a24c8] text-white"
              >
                {canvaConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {canvaExpired ? "Reconnect" : "Connect Canva"}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleDisconnectCanva}
                disabled={canvaDisconnecting}
                className="text-destructive border-destructive hover:bg-destructive/10"
              >
                {canvaDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {canvaDisconnectConfirm ? "Confirm Disconnect" : "Disconnect"}
              </Button>
            )}
            {canvaDisconnectConfirm && (
              <Button variant="ghost" onClick={() => setCanvaDisconnectConfirm(false)}>
                Cancel
              </Button>
            )}
          </div>
          {canvaDisconnectConfirm && (
            <p className="text-xs text-muted-foreground mt-2">
              Disconnecting Canva will remove the connection but will not delete any existing
              moodboard designs or embeds.
            </p>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp / WATI card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">WhatsApp Business (WATI)</CardTitle>
            <StatusBadge status={watiStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send automated WhatsApp messages to clients and contractors via{" "}
            <span className="font-medium">Wati.io</span>. Create a WATI account, add your WhatsApp
            Business number, and paste the credentials below.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>WATI API URL</Label>
            <Input
              placeholder="live-mt-server.wati.io"
              value={watiUrl}
              onChange={(e) => setWatiUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">The host from your WATI dashboard (no https:// prefix).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>WATI API Key</Label>
            <div className="relative">
              <Input
                type={showWatiKey ? "text" : "password"}
                placeholder="eyJ..."
                value={watiKey}
                onChange={(e) => setWatiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowWatiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showWatiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveWati}
              disabled={watiSaving}
              className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            >
              {watiSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleTestWati}
              disabled={watiTesting || !watiUrl.trim() || !watiKey.trim()}
            >
              {watiTesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email / Resend card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Transactional Email (Resend)</CardTitle>
            <StatusBadge status={resendStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send invoice and notification emails from your own domain using{" "}
            <span className="font-medium">Resend</span>. Verify your sending domain in Resend, then
            paste the API key below.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Resend API Key</Label>
            <div className="relative">
              <Input
                type={showResendKey ? "text" : "password"}
                placeholder="re_..."
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowResendKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Sending Email Address</Label>
              <Input
                type="email"
                placeholder="hello@yourstudio.com"
                value={sendingEmail}
                onChange={(e) => setSendingEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder="Studio Kasa"
                value={sendingEmailName}
                onChange={(e) => setSendingEmailName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveResend}
              disabled={resendSaving}
              className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            >
              {resendSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleTestResend}
              disabled={resendTesting || !resendKey.trim() || !sendingEmail.trim()}
            >
              {resendTesting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Send test email
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Razorpay card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="6" fill="#072654"/>
                <path d="M6 17L10.5 7H14L16 12H12.5L14.5 17H11L9.5 13H8.5L7 17H6Z" fill="#3395FF"/>
              </svg>
              <CardTitle className="text-base font-semibold">Razorpay</CardTitle>
            </div>
            <StatusBadge status={razorpayStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accept online payments from clients via Razorpay payment links. Create a Razorpay
            account, generate API keys, and paste them below.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Key ID</Label>
              <Input
                placeholder="rzp_live_..."
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Key Secret</Label>
              <div className="relative">
                <Input
                  type={showRazorpaySecret ? "text" : "password"}
                  placeholder="••••••••••••••••"
                  value={razorpayKeySecret}
                  onChange={(e) => setRazorpayKeySecret(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRazorpaySecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showRazorpaySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Webhook Secret</Label>
            <div className="relative">
              <Input
                type={showRazorpayWebhookSecret ? "text" : "password"}
                placeholder="••••••••••••••••"
                value={razorpayWebhookSecret}
                onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowRazorpayWebhookSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showRazorpayWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find in Razorpay Dashboard → Webhooks. Required for payment auto-reconciliation.
            </p>
          </div>

          <div className="flex items-start gap-3 py-2">
            <Switch
              id="razorpay-pass-fee"
              checked={razorpayPassFee}
              onCheckedChange={setRazorpayPassFee}
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="razorpay-pass-fee" className="text-sm font-medium cursor-pointer">
                Pass Razorpay fee to client
              </label>
              <p className="text-xs text-muted-foreground">
                When enabled, a 2% processing fee is added to the payment link amount.
                The stored invoice total is unchanged.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={saveRazorpay}
              disabled={razorpaySaving}
              className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
            >
              {razorpaySaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
