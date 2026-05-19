import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getPortfolioProjects } from "@/app/actions/portfolio"
import { PortfolioPageClient } from "./portfolio-page-client"

export const metadata: Metadata = { title: "Portfolio" }

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single()

  const portfolioProjects = await getPortfolioProjects().catch(() => [])

  return (
    <PortfolioPageClient
      portfolioProjects={portfolioProjects}
      currentUserRole={profile?.role ?? "designer"}
    />
  )
}
