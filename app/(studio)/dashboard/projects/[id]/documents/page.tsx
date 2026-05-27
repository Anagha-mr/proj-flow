import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject } from "@/app/actions/projects"
import { DocumentsTab } from "@/components/projects/documents/documents-tab"

export default async function ProjectDocumentsPage({
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

  return (
    <DocumentsTab
      projectId={id}
      studioId={profile?.studio_id ?? ""}
      projectMembers={project.members
        .filter((m) => m.user !== null)
        .map((m) => ({ id: m.user!.id, name: m.user!.name, role: m.user!.role }))}
      userRole={profile?.role ?? "designer"}
      currentUserId={user!.id}
    />
  )
}
