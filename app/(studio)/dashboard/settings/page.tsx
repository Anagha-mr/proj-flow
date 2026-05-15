import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { NotificationPreferences } from "@/components/settings/notification-preferences"
import { BillingTab } from "@/components/settings/billing-tab"
import { IntegrationsTab } from "@/components/settings/integrations-tab"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id, role")
    .eq("id", user!.id)
    .single()

  const studioId = profile?.studio_id ?? ""

  const { data: studio } = await supabase
    .from("studios")
    .select("plan_tier, whatsapp_number, wati_api_url, wati_api_key, resend_api_key, sending_email, sending_email_name")
    .eq("id", studioId)
    .single()

  const isOwner = profile?.role === "owner"

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Studio profile, GSTIN, roles &amp; permissions, notifications, integrations
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

      {isOwner && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Integrations</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect WhatsApp Business and transactional email to your studio account.
            </p>
          </div>
          <IntegrationsTab
            studioId={studioId}
            initialWatiUrl={studio?.wati_api_url ?? null}
            initialWatiKey={studio?.wati_api_key ?? null}
            initialResendKey={studio?.resend_api_key ?? null}
            initialSendingEmail={studio?.sending_email ?? null}
            initialSendingEmailName={studio?.sending_email_name ?? null}
          />
        </section>
      )}

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
