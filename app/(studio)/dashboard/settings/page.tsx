import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { NotificationPreferences } from "@/components/settings/notification-preferences"
import { BillingTab } from "@/components/settings/billing-tab"
import { IntegrationsTab } from "@/components/settings/integrations-tab"
import { POThresholdSettings } from "@/components/settings/po-threshold-settings"
import { getCanvaConnectionStatus } from "@/app/actions/canva"

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studio } = await (supabase.from as any)("studios")
    .select("plan_tier, whatsapp_number, wati_api_url, wati_api_key, resend_api_key, sending_email, sending_email_name, po_approval_threshold, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, razorpay_pass_fee_to_client, ai_enabled")
    .eq("id", studioId)
    .single()

  const isOwner = profile?.role === "owner"

  const canvaStatus = isOwner ? await getCanvaConnectionStatus().catch(() => null) : null

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
            canvaStatus={canvaStatus}
            initialRazorpayKeyId={studio?.razorpay_key_id ?? null}
            initialRazorpayKeySecret={studio?.razorpay_key_secret ?? null}
            initialRazorpayWebhookSecret={studio?.razorpay_webhook_secret ?? null}
            initialRazorpayPassFee={studio?.razorpay_pass_fee_to_client ?? false}
            initialAiEnabled={studio?.ai_enabled !== false}
          />
        </section>
      )}

      {isOwner && (
        <section className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a2e]">Finance &amp; Procurement</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure purchase order approval thresholds.
              </p>
            </div>
            <a
              href="/dashboard/finance"
              className="text-sm text-[#e94560] hover:underline shrink-0 mt-1"
            >
              View Studio P&amp;L →
            </a>
          </div>
          <POThresholdSettings
            initialThreshold={typeof studio?.po_approval_threshold === 'number' ? studio.po_approval_threshold : 0}
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
