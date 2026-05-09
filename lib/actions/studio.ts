"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function createStudioAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const name = (formData.get("studio_name") as string)?.trim()
  if (!name) return

  // Call the atomic DB function which creates studio + links user as owner
  const { error } = await supabase.rpc("handle_new_user_signup", {
    p_user_id: user.id,
    p_user_name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Studio Owner",
    p_user_email: user.email!,
    p_studio_name: name,
  })

  if (error) {
    // User row may already exist (created by trigger); fall back to
    // creating only the studio and updating the user's studio_id.
    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .insert({ name })
      .select("id")
      .single()

    if (studioError || !studio) return

    await supabase
      .from("users")
      .update({ studio_id: studio.id, role: "owner" })
      .eq("id", user.id)
  }

  redirect("/dashboard")
}

export async function completeOnboardingAction(
  studioId: string,
  data: {
    name?: string
    logo_url?: string | null
    gstin?: string | null
    state_code?: string | null
    address_line1?: string | null
    address_line2?: string | null
    address_line3?: string | null
    postcode?: string | null
    contact_phone?: string | null
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("studios")
    .update({ ...data, onboarding_complete: true })
    .eq("id", studioId)

  if (error) return { error: error.message }
  return { success: true }
}
