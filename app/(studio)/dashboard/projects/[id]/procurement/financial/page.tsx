import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FinancialTab } from "@/components/projects/procurement/financial-tab"

export default async function ProjectProcurementFinancialPage({
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

  return (
    <FinancialTab
      projectId={id}
      userRole={profile?.role ?? "designer"}
    />
  )
}
