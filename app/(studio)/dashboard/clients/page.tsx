import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getClientsWithDetails } from "@/app/actions/projects"
import { ClientsClient } from "@/components/clients/clients-client"

export const metadata: Metadata = { title: "Clients" }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single()

  const clients = await getClientsWithDetails().catch(() => [])

  return (
    <ClientsClient
      initialClients={clients}
      currentUserRole={profile?.role ?? "designer"}
    />
  )
}
