import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getClients, getTemplates, getStudioUsers } from "@/app/actions/projects"
import { ProjectWizard } from "@/components/projects/project-wizard"

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()

  if (!profile?.studio_id) redirect("/dashboard")

  const [clients, templates, studioUsers] = await Promise.all([
    getClients(),
    getTemplates(),
    getStudioUsers(),
  ])

  return (
    <ProjectWizard
      currentUserId={user.id}
      studioId={profile.studio_id}
      clients={clients}
      templates={templates}
      studioUsers={studioUsers}
    />
  )
}
