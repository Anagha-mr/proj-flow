import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getQuoteRequests } from "@/app/actions/quotes"
import { getVendors } from "@/app/actions/vendors"
import { ProcurementTab } from "@/components/projects/procurement/procurement-tab"

export default async function ProjectProcurementPage({
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

  const [initialQuoteRequests, vendors] = await Promise.all([
    getQuoteRequests(id).catch(() => []),
    getVendors().catch(() => []),
  ])

  return (
    <ProcurementTab
      projectId={id}
      studioId={profile?.studio_id ?? ""}
      userRole={profile?.role ?? "designer"}
      currentUserId={user.id}
      initialQuoteRequests={initialQuoteRequests}
      vendors={vendors}
    />
  )
}
