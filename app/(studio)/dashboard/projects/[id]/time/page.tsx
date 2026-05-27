import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject, getStudioUsers } from "@/app/actions/projects"
import { getTimeEntries } from "@/app/actions/time-tracking"
import { TimeTab } from "@/components/projects/time/time-tab"

export default async function ProjectTimePage({
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
    .select("role, studio_id, name, hourly_rate")
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

  const initialEntries = await getTimeEntries(id).catch(() => [])

  return (
    <TimeTab
      project={{
        id,
        studio_id: profile?.studio_id ?? "",
        name: project.name,
        phases: Array.isArray(project.phases)
          ? (project.phases as Array<{ name: string }>)
          : [],
      }}
      initialEntries={initialEntries}
      currentUser={{
        id: user.id,
        name: currentUserName,
        role: profile?.role ?? "designer",
        hourly_rate: (profile?.hourly_rate as number | null) ?? null,
      }}
      studioUsers={studioUsers.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
    />
  )
}
