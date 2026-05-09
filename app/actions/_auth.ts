"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.studio_id) throw new Error("No studio found")
  return {
    supabase,
    userId: user.id,
    studioId: profile.studio_id,
    role: profile.role as string,
  }
}
