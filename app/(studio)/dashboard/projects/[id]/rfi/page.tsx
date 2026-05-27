import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getStudioUsers } from "@/app/actions/projects"
import { getRfis } from "@/app/actions/rfis"
import { getProjectContractors } from "@/app/actions/contractors"
import { getDocuments } from "@/app/actions/documents"
import { RfiTab } from "@/components/projects/rfis/rfi-tab"

export default async function ProjectRfiPage({
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

  const [initialRfis, projectContractors, projectDocuments] = await Promise.all([
    getRfis(id).catch(() => []),
    getProjectContractors(id).catch(() => []),
    getDocuments(id).catch(() => []),
  ])

  return (
    <RfiTab
      project={{ id, studio_id: profile?.studio_id ?? "", name: project.name }}
      initialRfis={initialRfis}
      currentUser={{ id: user.id, name: currentUserName, role: profile?.role ?? "designer" }}
      projectDocuments={projectDocuments.map((d) => ({ id: d.id, name: d.name }))}
      projectContractors={projectContractors}
    />
  )
}
