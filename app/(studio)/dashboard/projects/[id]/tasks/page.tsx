import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getStudioUsers } from "@/app/actions/projects"
import { TasksTab } from "@/components/projects/tasks/tasks-tab"

export default async function ProjectTasksPage({
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

  const studioUsers = await getStudioUsers()

  const projectPhases = (
    Array.isArray(project.phases)
      ? (project.phases as Array<{ id: string; name: string; color: string; start_date?: string; end_date?: string }>)
      : []
  ).filter((p) => p.id && p.name)

  return (
    <TasksTab
      projectId={id}
      projectPhases={projectPhases}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      studioUsers={studioUsers}
    />
  )
}
