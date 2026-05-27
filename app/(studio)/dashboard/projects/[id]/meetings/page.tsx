import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getStudioUsers } from "@/app/actions/projects"
import { getMeetings } from "@/app/actions/meetings"
import { MeetingsTab } from "@/components/projects/meetings/meetings-tab"

export default async function ProjectMeetingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from("users")
    .select("role, studio_id, name")
    .eq("id", user.id)
    .single()

  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }

  const studioUsers = await getStudioUsers()
  const currentUserName = studioUsers.find((u) => u.id === user.id)?.name ?? profile?.name ?? ""

  const initialMeetings = await getMeetings(id).catch(() => [])

  return (
    <MeetingsTab
      project={{ id, studio_id: profile?.studio_id ?? "", name: project.name }}
      initialMeetings={initialMeetings}
      currentUser={{ id: user.id, name: currentUserName, role: profile?.role ?? "designer" }}
      studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
    />
  )
}
