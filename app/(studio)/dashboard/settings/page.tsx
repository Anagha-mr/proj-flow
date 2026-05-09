import type { Metadata } from "next"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Studio profile, GSTIN, roles &amp; permissions, notifications, WhatsApp integration</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Settings panel coming in Sprint 1 final pass
      </div>
    </div>
  )
}
