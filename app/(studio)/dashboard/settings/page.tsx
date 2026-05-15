import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { NotificationPreferences } from "@/components/settings/notification-preferences"
import { BillingTab } from "@/components/settings/billing-tab"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user!.id)
    .single()

  const studioId = profile?.studio_id ?? ""

  const { data: studio } = await supabase
    .from("studios")
    .select("plan_tier, whatsapp_number")
    .eq("id", studioId)
    .single()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Studio profile, GSTIN, roles &amp; permissions, notifications, WhatsApp integration
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e]">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose how you receive alerts for project activity.
          </p>
        </div>
        <NotificationPreferences
          userId={user!.id}
          studioId={studioId}
          studioHasWhatsapp={!!studio?.whatsapp_number}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e]">Billing &amp; Plan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your subscription plan.
          </p>
        </div>
        <BillingTab
          currentPlan={studio?.plan_tier ?? "starter"}
          studioId={studioId}
        />
      </section>
    </div>
  )
}
