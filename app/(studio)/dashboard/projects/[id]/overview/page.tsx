import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getProjectTaskCounts, getUpcomingTasks, getStudioUsers } from "@/app/actions/projects"
import { OverviewTab } from "@/components/projects/overview-tab"

export default async function ProjectOverviewPage({
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

  const [taskCounts, upcomingTasks, studioUsers] = await Promise.all([
    getProjectTaskCounts(id),
    getUpcomingTasks(id),
    getStudioUsers(),
  ])

  return (
    <OverviewTab
      project={project as Parameters<typeof OverviewTab>[0]["project"]}
      taskCounts={taskCounts}
      upcomingTasks={upcomingTasks}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      studioUsers={studioUsers}
    />
  )
}
