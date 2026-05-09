"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

type AuthState = { error?: string; success?: boolean; email?: string } | null

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  redirect("/dashboard")
}

export async function magicLinkAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return { success: true, email }
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = formData.get("name") as string
  const studioName = (formData.get("studio_name") as string)?.trim()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!studioName) return { error: "Studio name is required" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, studio_name: studioName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  // Email confirmation disabled — Supabase returns a session immediately
  if (data.session) redirect("/dashboard")

  // Email confirmation enabled — ask user to check inbox
  return { success: true, email }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
