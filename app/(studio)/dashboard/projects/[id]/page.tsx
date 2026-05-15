import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getProjectTaskCounts, getUpcomingTasks, getStudioUsers } from "@/app/actions/projects"
import { ProjectDetailClient } from "@/components/projects/project-detail-client"
import { getSiteUpdates } from "@/app/actions/site"
import { getMeetings } from "@/app/actions/meetings"
import { getRfis } from "@/app/actions/rfis"
import { getSnagItems } from "@/app/actions/snags"
import { getProjectContractors } from "@/app/actions/contractors"
import { getDocuments } from "@/app/actions/documents"
import { getTimeEntries } from "@/app/actions/time-tracking"
import { getStagePayments } from "@/app/actions/stage-payments"
import { getSpecItems } from "@/app/actions/spec"

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
    .select("role, studio_id, hourly_rate")
    .eq("id", user!.id)
    .single()

  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }

  const { data: studio } = await supabase
    .from("studios")
    .select("name, state_code, gstin, bank_details")
    .eq("id", profile?.studio_id ?? "")
    .single()

  let clientStateCode = ""
  if (project.client?.id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("state_code")
      .eq("id", project.client.id)
      .single()
    clientStateCode = clientRow?.state_code ?? ""
  }

  const [
    taskCounts,
    upcomingTasks,
    studioUsers,
    initialSiteUpdates,
    initialMeetings,
    initialRfis,
    initialSnags,
    projectContractors,
    projectDocuments,
    initialTimeEntries,
    initialStagePayments,
    initialSpecItems,
  ] = await Promise.all([
    getProjectTaskCounts(id),
    getUpcomingTasks(id),
    getStudioUsers(),
    getSiteUpdates(id).catch(() => []),
    getMeetings(id).catch(() => []),
    getRfis(id).catch(() => []),
    getSnagItems(id).catch(() => []),
    getProjectContractors(id).catch(() => []),
    getDocuments(id).catch(() => []),
    getTimeEntries(id).catch(() => []),
    getStagePayments(id).catch(() => []),
    getSpecItems(id).catch(() => []),
  ])

  const currentUserName = studioUsers.find((u) => u.id === user!.id)?.name ?? ""

  return (
    <ProjectDetailClient
      project={project}
      taskCounts={taskCounts}
      upcomingTasks={upcomingTasks}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
      currentUserName={currentUserName}
      studioId={profile?.studio_id ?? ""}
      studioUsers={studioUsers}
      studioStateCode={studio?.state_code ?? ""}
      clientStateCode={clientStateCode}
      studioName={studio?.name ?? ""}
      studioGstin={studio?.gstin ?? null}
      studioBankDetails={(studio?.bank_details as Record<string, string> | null) ?? null}
      initialSiteUpdates={initialSiteUpdates}
      initialMeetings={initialMeetings}
      initialRfis={initialRfis}
      initialSnags={initialSnags}
      projectContractors={projectContractors}
      projectDocuments={projectDocuments.map((d) => ({ id: d.id, name: d.name }))}
      initialTimeEntries={initialTimeEntries}
      initialStagePayments={initialStagePayments}
      initialSpecItems={initialSpecItems}
      currentUserHourlyRate={(profile?.hourly_rate as number | null) ?? null}
    />
  )
}
