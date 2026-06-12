"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CalendarDays } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { disconnectCalendar } from "@/app/actions/calendar"

interface CalendarSettingsCardProps {
  connected: boolean
  googleEmail: string | null
  lastSyncAt: string | null
}

function formatRelative(isoString: string | null): string {
  if (!isoString) return "Never"
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export function CalendarSettingsCard({
  connected: initialConnected,
  googleEmail: initialGoogleEmail,
  lastSyncAt,
}: CalendarSettingsCardProps) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [connected, setConnected] = useState(initialConnected)
  const [googleEmail, setGoogleEmail] = useState(initialGoogleEmail)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Show toast when redirected back from OAuth with ?calendar=connected / ?calendar=error
  useEffect(() => {
    const param = searchParams.get("calendar")
    if (param === "connected") {
      toast({ title: "Google Calendar connected successfully." })
      setConnected(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("calendar")
      router.replace(url.pathname + (url.search || ""))
    } else if (param === "error") {
      toast({ title: "Failed to connect Google Calendar. Please try again.", variant: "destructive" })
      const url = new URL(window.location.href)
      url.searchParams.delete("calendar")
      router.replace(url.pathname + (url.search || ""))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await disconnectCalendar()
      setConnected(false)
      setGoogleEmail(null)
      toast({ title: "Google Calendar disconnected." })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      toast({
        title:
          data.synced > 0
            ? `Synced — ${data.synced} event${data.synced === 1 ? "" : "s"} imported`
            : "Already up to date.",
      })
      router.refresh()
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays
              className="w-5 h-5"
              style={{ color: connected ? "#1D9E75" : "rgba(255,255,255,0.35)" }}
            />
            <CardTitle className="text-base font-semibold">Google Calendar Sync</CardTitle>
          </div>
          {connected ? (
            <span className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "#1D9E75" }}>
              <span style={{ fontSize: 16 }}>●</span> Connected
              {googleEmail && <span className="text-muted-foreground">— {googleEmail}</span>}
            </span>
          ) : (
            <span className="text-[12px] flex items-center gap-1.5 text-muted-foreground">
              <span style={{ fontSize: 16 }}>○</span> Not connected
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {connected
            ? "Your tasks, meetings, and deadlines appear on your personal calendar. Personal events feed into team availability."
            : "Sync project milestones, meetings, and due dates to your Google Calendar — and see team availability conflicts."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connected && (
          <p className="text-sm text-muted-foreground">
            Last synced: {formatRelative(lastSyncAt)}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {connected ? (
            <>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Sync now
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={disconnecting}
                    className="text-destructive border-destructive hover:bg-destructive/10"
                  >
                    {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Disconnecting will stop syncing your calendar. Events already pushed to
                      Google Calendar will remain there.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <a
              href="/api/calendar/auth"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium transition-colors"
              style={{
                background: "var(--color-accent, #e94560)",
                color: "#fff",
              }}
            >
              Connect Calendar →
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
