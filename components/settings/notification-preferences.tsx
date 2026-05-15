"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { upsertNotificationPreference, getNotificationPreferences } from "@/app/actions/notifications"
import { useToast } from "@/hooks/use-toast"

const EVENT_TYPES = [
  { key: "task_overdue",          label: "Task overdue" },
  { key: "task_assigned",         label: "Task assigned" },
  { key: "document_uploaded",     label: "Document uploaded" },
  { key: "procurement_actioned",  label: "Procurement actioned" },
  { key: "invoice_sent",          label: "Invoice sent" },
  { key: "invoice_overdue",       label: "Invoice overdue" },
  { key: "site_update_posted",    label: "Site update posted" },
  { key: "rfi_received",          label: "RFI received" },
]

interface NotificationPreferencesProps {
  userId: string
  studioId: string
  studioHasWhatsapp: boolean
}

type PrefRow = { in_app: boolean; email: boolean; whatsapp: boolean }
type PrefMap = Record<string, PrefRow>

const DEFAULT_PREFS: PrefRow = { in_app: true, email: true, whatsapp: false }

export function NotificationPreferences({ userId, studioId, studioHasWhatsapp }: NotificationPreferencesProps) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<PrefMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotificationPreferences(userId)
      .then((rows) => {
        const map: PrefMap = {}
        rows.forEach((r) => { map[r.event_type] = { in_app: r.in_app, email: r.email, whatsapp: r.whatsapp } })
        setPrefs(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  async function handleToggle(eventType: string, channel: 'in_app' | 'email' | 'whatsapp', value: boolean) {
    const prev = prefs[eventType] ?? DEFAULT_PREFS
    setPrefs((p) => ({ ...p, [eventType]: { ...prev, [channel]: value } }))
    try {
      await upsertNotificationPreference(userId, studioId, eventType, channel, value)
      toast({ title: "Saved ✓" })
    } catch (err) {
      setPrefs((p) => ({ ...p, [eventType]: prev }))
      toast({ title: "Failed to save", description: String(err), variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a2e] text-white">
              <th className="text-left py-3 px-4 font-medium">Event</th>
              <th className="text-center py-3 px-3 font-medium">In-App</th>
              <th className="text-center py-3 px-3 font-medium">Email</th>
              <th className="text-center py-3 px-3 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {EVENT_TYPES.map((event, idx) => {
              const row = prefs[event.key] ?? DEFAULT_PREFS
              return (
                <tr key={event.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-3 px-4 font-medium text-gray-800">{event.label}</td>
                  <td className="py-3 px-3 text-center">
                    <Switch
                      checked={row.in_app}
                      onCheckedChange={(v) => handleToggle(event.key, "in_app", v)}
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Switch
                      checked={row.email}
                      onCheckedChange={(v) => handleToggle(event.key, "email", v)}
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    {studioHasWhatsapp ? (
                      <Switch
                        checked={row.whatsapp}
                        onCheckedChange={(v) => handleToggle(event.key, "whatsapp", v)}
                      />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block cursor-not-allowed opacity-50">
                            <Switch
                              checked={false}
                              onCheckedChange={() => {}}
                              disabled
                              className="cursor-not-allowed"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connect WhatsApp in Studio settings</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
