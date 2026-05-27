import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getStudioUsers } from "@/app/actions/projects"
import { getSnagItems } from "@/app/actions/snags"
import { getProjectContractors } from "@/app/actions/contractors"
import { SnagTab } from "@/components/projects/snags/snag-tab"

export default async function ProjectSnagPage({
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

  const [initialSnags, projectContractors] = await Promise.all([
    getSnagItems(id).catch(() => []),
    getProjectContractors(id).catch(() => []),
  ])

  return (
    <SnagTab
      project={{ id, studio_id: profile?.studio_id ?? "", name: project.name }}
      initialSnags={initialSnags}
      currentUser={{ id: user.id, name: currentUserName, role: profile?.role ?? "designer" }}
      projectContractors={projectContractors}
      studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
    />
  )
}
