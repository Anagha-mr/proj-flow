import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject } from "@/app/actions/projects"
import { TimelineTab } from "@/components/projects/timeline-tab"

export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("role, studio_id")
    .eq("id", user!.id)
    .single()

  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }

  // Assignee dropdown must only offer people who are members of this project,
  // not every user in the studio — project.members is already scoped + joined to users.
  const projectMembers = project.members
    .filter((m) => m.user !== null)
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.name,
      profile_photo_url: m.user!.profile_photo_url,
      role: m.user!.role,
    }))

  const projectPhases = (
    Array.isArray(project.phases)
      ? (project.phases as Array<{ id: string; name: string; color: string; start_date?: string; end_date?: string }>)
      : []
  ).filter((p) => p.id && p.name)

  return (
    <TimelineTab
      projectId={id}
      projectPhases={projectPhases}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      studioUsers={projectMembers}
    />
  )
}
