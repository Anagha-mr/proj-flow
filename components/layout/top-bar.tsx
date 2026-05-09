import { createClient } from "@/lib/supabase/server"
import { TopBarClient } from "./top-bar-client"

export async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let studioName = ""

  if (user) {
    const { data } = await supabase
      .from("users")
      .select("name, role, profile_photo_url, studio:studios(name)")
      .eq("id", user.id)
      .single()

    profile = data
    studioName = (data?.studio as { name?: string } | null)?.name ?? ""
  }

  return (
    <TopBarClient
      userName={profile?.name ?? user?.email ?? ""}
      userRole={profile?.role ?? "designer"}
      userPhotoUrl={profile?.profile_photo_url ?? null}
      studioName={studioName}
    />
  )
}
