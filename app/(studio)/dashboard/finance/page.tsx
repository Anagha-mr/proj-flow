import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { Lock } from "lucide-react"
import {
  getStudioPLSummary,
  getProjectPLRows,
  getStudioExpenses,
  getGSTSummary,
} from "@/app/actions/studio-finance"
import { StudioFinanceClient } from "./studio-finance-client"

export const metadata: Metadata = { title: "Studio Finance" }

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role ?? "designer") as StudioRole

  if (!hasPermission(role, "view_financials")) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="p-4 rounded-full bg-muted">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-lg">This page is restricted</p>
          <p className="text-sm text-muted-foreground mt-1">
            Studio Finance is only accessible to senior designers and above.
          </p>
        </div>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()

  const [plSummary, projectRows, studioExpenses, gstSummary] = await Promise.all([
    getStudioPLSummary({ type: "annual", year: currentYear }),
    getProjectPLRows(),
    getStudioExpenses({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31` }),
    getGSTSummary({ from: `${currentYear}-01-01`, to: `${currentYear}-12-31` }),
  ])

  return (
    <StudioFinanceClient
      initialPLSummary={plSummary}
      initialProjectRows={projectRows}
      initialStudioExpenses={studioExpenses}
      initialGSTSummary={gstSummary}
      userRole={role}
      currentYear={currentYear}
    />
  )
}
