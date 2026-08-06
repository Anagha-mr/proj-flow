import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getContractors, getProjectContractors } from "@/app/actions/contractors"
import { getStagePayments } from "@/app/actions/stage-payments"
import { ProjectContractorsTab } from "@/components/projects/contractors/project-contractors-tab"

export default async function ProjectContractorsPage({
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
    .select("role, studio_id")
    .eq("id", user.id)
    .single()

  const [projectContractors, initialStagePayments, studioContractors] = await Promise.all([
    getProjectContractors(id).catch(() => []),
    getStagePayments(id).catch(() => []),
    getContractors().catch(() => []),
  ])

  return (
    <ProjectContractorsTab
      project={{ id }}
      projectContractors={projectContractors}
      studioContractors={studioContractors}
      initialStagePayments={initialStagePayments}
      currentUser={{ id: user.id, role: profile?.role ?? "designer" }}
    />
  )
}
