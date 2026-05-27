import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject } from "@/app/actions/projects"
import { getGalleryItems } from "@/app/actions/portfolio"
import { PortfolioTab } from "@/components/projects/portfolio/portfolio-tab"

export default async function ProjectPortfolioPage({
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

  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }

  const galleryItems = await getGalleryItems(id).catch(() => [])

  return (
    <PortfolioTab
      project={{
        id: project.id,
        name: project.name,
        type: project.type,
        status: project.status,
        cover_image_url: project.cover_image_url,
        portfolio_summary: (project as Record<string, unknown>).portfolio_summary as string | null ?? null,
        portfolio_key_decisions: (project as Record<string, unknown>).portfolio_key_decisions as string | null ?? null,
        portfolio_location_city: (project as Record<string, unknown>).portfolio_location_city as string | null ?? null,
        portfolio_year_completed: (project as Record<string, unknown>).portfolio_year_completed as number | null ?? null,
        portfolio_published: (project as Record<string, unknown>).portfolio_published as boolean ?? false,
        client: project.client,
        members: project.members.map((m) => ({
          user_id: m.user_id,
          project_role: m.project_role,
          user: m.user ? { id: m.user.id, name: m.user.name } : null,
        })),
      }}
      galleryItems={galleryItems}
      studioId={profile?.studio_id ?? ""}
      userRole={profile?.role ?? "designer"}
    />
  )
}
