import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProject } from "@/app/actions/projects"
import { FinanceTab } from "@/components/projects/finance/finance-tab"

export default async function ProjectFinancePage({
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

  const { data: studio } = await supabase
    .from("studios")
    .select("name, state_code, gstin, bank_details")
    .eq("id", profile?.studio_id ?? "")
    .single()

  let clientStateCode = ""
  if (project.client?.id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("state_code")
      .eq("id", project.client.id)
      .single()
    clientStateCode = clientRow?.state_code ?? ""
  }

  return (
    <FinanceTab
      projectId={id}
      studioId={profile?.studio_id ?? ""}
      userRole={profile?.role ?? "designer"}
      currentUserId={user.id}
      studioStateCode={studio?.state_code ?? ""}
      clientStateCode={clientStateCode}
      studioName={studio?.name ?? ""}
      studioGstin={studio?.gstin ?? null}
      studioBankDetails={(studio?.bank_details as Record<string, string> | null) ?? null}
      clientId={project.client?.id ?? ""}
    />
  )
}
