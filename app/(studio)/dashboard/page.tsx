import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getDashboardMetrics, getDashboardProjectCards, getDashboardActivityFeed } from "@/app/actions/dashboard"
import { getPendingLeaveRequestsCount } from "@/app/actions/team"
import { getPendingNarratives } from "@/app/actions/narratives"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user!.id)
    .single()

  const firstName = profile?.name?.split(" ")[0] ?? "there"
  const role = profile?.role ?? "designer"

  const [metrics, projectCards, activityFeed, leaveAlertCount, pendingNarratives] = await Promise.all([
    getDashboardMetrics().catch(() => ({
      activeProjectsCount: 0,
      tasksDueTodayCount: 0,
      overdueInvoicesTotal: 0,
      overdueInvoicesCount: 0,
      teamCapacity: [],
    })),
    getDashboardProjectCards().catch(() => []),
    getDashboardActivityFeed().catch(() => []),
    getPendingLeaveRequestsCount().catch(() => 0),
    getPendingNarratives().catch(() => []),
  ])

  return (
    <DashboardClient
      firstName={firstName}
      role={role}
      metrics={metrics}
      projectCards={projectCards}
      activityFeed={activityFeed}
      leaveAlertCount={leaveAlertCount}
      pendingNarratives={pendingNarratives}
    />
  )
}
