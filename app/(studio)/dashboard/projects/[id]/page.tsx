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
    .select("role, studio_id")
    .eq("id", user!.id)
    .single()

  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }

  // Fetch studio details for Finance tab
  const { data: studio } = await supabase
    .from("studios")
    .select("name, state_code, gstin, bank_details")
    .eq("id", profile?.studio_id ?? "")
    .single()

  // Fetch client state_code for GST split calculation
  let clientStateCode = ""
  if (project.client?.id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("state_code")
      .eq("id", project.client.id)
      .single()
    clientStateCode = clientRow?.state_code ?? ""
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
      studioId={profile?.studio_id ?? ""}
      studioUsers={studioUsers}
      studioStateCode={studio?.state_code ?? ""}
      clientStateCode={clientStateCode}
      studioName={studio?.name ?? ""}
      studioGstin={studio?.gstin ?? null}
      studioBankDetails={(studio?.bank_details as Record<string, string> | null) ?? null}
    />
  )
}
