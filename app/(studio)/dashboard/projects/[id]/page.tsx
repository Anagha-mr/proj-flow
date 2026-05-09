import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getProjectTaskCounts, getUpcomingTasks, getStudioUsers } from "@/app/actions/projects"
import { ProjectDetailClient } from "@/components/projects/project-detail-client"

export const metadata: Metadata = { title: "Project" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("role")
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
    <ProjectDetailClient
      project={project}
      taskCounts={taskCounts}
      upcomingTasks={upcomingTasks}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      studioUsers={studioUsers}
    />
  )
}
