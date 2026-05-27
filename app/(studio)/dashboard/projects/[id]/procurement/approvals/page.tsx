import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ApprovalsTab } from "@/components/projects/procurement/approvals-tab"

export default async function ProjectProcurementApprovalsPage({
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
    .select("role")
    .eq("id", user.id)
    .single()

  return (
    <ApprovalsTab
      projectId={id}
      userRole={profile?.role ?? "designer"}
    />
  )
}
