import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSiteUpdates } from "@/app/actions/site"
import { SiteTab } from "@/components/projects/site/site-tab"

export default async function ProjectSitePage({
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

  const initialUpdates = await getSiteUpdates(id).catch(() => [])

  return (
    <SiteTab
      project={{ id, studio_id: profile?.studio_id ?? "" }}
      initialUpdates={initialUpdates}
      currentUser={{ id: user.id, role: profile?.role ?? "designer" }}
    />
  )
}
