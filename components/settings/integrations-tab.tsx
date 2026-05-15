"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { updateStudioIntegrations, testWatiConnection, testResendEmail } from "@/app/actions/settings"

interface IntegrationsTabProps {
  studioId: string
  initialWatiUrl: string | null
  initialWatiKey: string | null
  initialResendKey: string | null
  initialSendingEmail: string | null
  initialSendingEmailName: string | null
}

export function IntegrationsTab({
  studioId,
  initialWatiUrl,
  initialWatiKey,
  initialResendKey,
  initialSendingEmail,
  initialSendingEmailName,
}: IntegrationsTabProps) {
  const { toast } = useToast()

  // WATI state
  const [watiUrl, setWatiUrl] = useState(initialWatiUrl ?? "")
  const [watiKey, setWatiKey] = useState(initialWatiKey ?? "")
  const [showWatiKey, setShowWatiKey] = useState(false)
  const [watiSaving, setWatiSaving] = useState(false)
  const [watiTesting, setWatiTesting] = useState(false)
  const [watiStatus, setWatiStatus] = useState<"connected" | "failed" | null>(
    initialWatiUrl && initialWatiKey ? "connected" : null
  )

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
    </div>
  )
}
