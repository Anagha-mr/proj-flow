import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject } from "@/app/actions/projects"
import { getSpecItems } from "@/app/actions/spec"
import { SpecTab } from "@/components/projects/spec/spec-tab"

export default async function ProjectSpecPage({
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

  const initialItems = await getSpecItems(id).catch(() => [])

  return (
    <SpecTab
      project={{ id, studio_id: profile?.studio_id ?? "", name: project.name }}
      initialItems={initialItems}
      currentUser={{ id: user!.id, role: profile?.role ?? "designer" }}
    />
  )
}
