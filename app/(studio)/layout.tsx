import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { CommandPalette } from "@/components/layout/command-palette"
import { OnboardingModal } from "@/components/dashboard/onboarding-modal"

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data } = await supabase
    .from("users")
    .select("studio_id, studio:studios(id, name, onboarding_complete)")
    .eq("id", user.id)
    .single()

  const studioId = data?.studio_id ?? null

  if (!studioId) redirect("/onboarding")

  const studio = data?.studio as { id: string; name: string; onboarding_complete: boolean } | null
  const studioName = studio?.name ?? ""
  const showOnboarding = studio?.onboarding_complete === false

  return (
    <SidebarProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "var(--color-shell, #0D0F1A)" }}
      >
        {/* Sidebar — handles its own collapse + mobile sheet */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopBar />
          <main
            className="flex-1 overflow-y-auto p-6"
            style={{ background: "var(--color-shell, #0D0F1A)" }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Command Palette — global, renders as Dialog portal */}
      <CommandPalette />

      {/* Onboarding modal */}
      {showOnboarding && (
        <OnboardingModal studioId={studioId} studioName={studioName} />
      )}
    </SidebarProvider>
  )
}
