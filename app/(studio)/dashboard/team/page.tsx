import type { Metadata } from "next"
import { getTeamMembers, getAnnouncements, getLeavePolicy } from "@/app/actions/team"
import { getResourceAllocationCalendar, getResourceConflicts } from "@/app/actions/calendar"
import { TeamPageClient } from "@/components/team/team-page-client"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single()

  const canManageTeam = profile?.role === "owner" || profile?.role === "senior_designer"

  const today = new Date()
  const weekStart = new Date(today)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
  const weekStartStr = weekStart.toISOString().split("T")[0]
  const weekEndStr = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [members, announcements, leavePolicy, busyBlocks, conflicts] = await Promise.all([
    getTeamMembers().catch(() => []),
    getAnnouncements().catch(() => []),
    getLeavePolicy().catch(() => null),
    canManageTeam
      ? getResourceAllocationCalendar(
          `${weekStartStr}T00:00:00Z`,
          `${weekEndStr}T23:59:59Z`
        ).catch(() => [])
      : Promise.resolve([]),
    canManageTeam
      ? getResourceConflicts(
          `${weekStartStr}T00:00:00Z`,
          `${weekEndStr}T23:59:59Z`
        ).catch(() => [])
      : Promise.resolve([]),
  ])

  // Build team members with calendar_connected status
  const teamMembersWithCalendar = members.map((m) => ({
    id: m.id,
    full_name: m.full_name ?? m.email,
    calendar_connected: m.calendar_connected ?? false,
  }))

  return (
    <TeamPageClient
      initialMembers={members}
      initialAnnouncements={announcements}
      initialLeavePolicy={leavePolicy}
      currentUserRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      initialBusyBlocks={busyBlocks}
      initialConflicts={conflicts}
      teamMembersWithCalendar={teamMembersWithCalendar}
      weekStart={weekStartStr}
    />
  )
}
