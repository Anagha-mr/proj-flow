import type { Metadata } from "next"
import { getTeamMembers, getAnnouncements, getLeavePolicy } from "@/app/actions/team"
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

  const [members, announcements, leavePolicy] = await Promise.all([
    getTeamMembers().catch(() => []),
    getAnnouncements().catch(() => []),
    getLeavePolicy().catch(() => null),
  ])

  return (
    <TeamPageClient
      initialMembers={members}
      initialAnnouncements={announcements}
      initialLeavePolicy={leavePolicy}
      currentUserRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
    />
  )
}
