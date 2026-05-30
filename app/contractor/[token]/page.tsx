// Public contractor view — no authentication required.
// Accessible at /contractor/[token]

import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import { ContractorStagePayments } from "@/components/contractor/stage-payments"

export default async function ContractorPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServiceClient()

  // Validate contractor token
  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, company_name, contact_name, contractor_token, contractor_token_expires_at, studio_id")
    .eq("contractor_token", token)
    .single()

  if (!contractor) notFound()

  const cont = contractor as Record<string, unknown>

  if (
    cont.contractor_token_expires_at &&
    new Date(cont.contractor_token_expires_at as string) < new Date()
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900">Link Expired</h1>
          <p className="mt-2 text-sm text-gray-500">
            This contractor link has expired. Please contact your project manager to
            get a new link.
          </p>
        </div>
      </div>
    )
  }

  // Fetch all stage payments for this contractor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stagePayments } = await (supabase.from as any)("stage_payments")
    .select("id, milestone_name, milestone_description, amount, status, released_at, contractor_confirmed_at, project_id")
    .eq("contractor_id", contractor.id)
    .order("expected_date", { ascending: true, nullsFirst: false }) as {
    data: Array<{
      id: string
      milestone_name: string
      milestone_description: string | null
      amount: number
      status: string
      released_at: string | null
      contractor_confirmed_at: string | null
      project_id: string
    }> | null
  }

  // Fetch project names
  const projectIds = [...new Set((stagePayments ?? []).map((p) => p.project_id))]
  const projectMap: Record<string, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds)
    ;(projects ?? []).forEach((p) => {
      projectMap[(p as Record<string, unknown>).id as string] = (p as Record<string, unknown>).name as string
    })
  }

  const payments = (stagePayments ?? []).map((p) => ({
    ...p,
    project_name: projectMap[p.project_id] ?? "Project",
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="w-8 h-8 rounded-[6px] bg-[#e94560] mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">
            {cont.company_name as string}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Hello, {cont.contact_name as string}. Here are your stage payments.
          </p>
        </div>

        <ContractorStagePayments
          contractorToken={token}
          payments={payments}
        />
      </div>
    </div>
  )
}
