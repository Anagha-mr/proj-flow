import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function generateCodeVerifier(): string {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return Buffer.from(array)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Buffer.from(digest)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error("[canva/auth] No user session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("users")
      .select("studio_id, role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "owner") {
      console.error("[canva/auth] User is not owner, role:", profile?.role)
      return NextResponse.json({ error: "Only studio owners can connect Canva" }, { status: 403 })
    }

    const clientId = process.env.CANVA_CLIENT_ID
    const redirectUri = process.env.CANVA_REDIRECT_URI

    if (!clientId || !redirectUri) {
      console.error("[canva/auth] Missing env vars — CANVA_CLIENT_ID:", !!clientId, "CANVA_REDIRECT_URI:", !!redirectUri)
      return NextResponse.json({ error: "Canva credentials not configured" }, { status: 500 })
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    // Encode both studioId and codeVerifier in the state parameter
    // Format: base64url({studioId}:{codeVerifier})
    const statePayload = Buffer.from(`${profile.studio_id}:${codeVerifier}`).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

    const url =
      `https://www.canva.com/api/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent("design:content:read design:content:write design:meta:read")}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=s256` +
      `&state=${encodeURIComponent(statePayload)}`

    console.log("[canva/auth] Returning OAuth URL successfully")
    return NextResponse.json({ url })

  } catch (err) {
    console.error("[canva/auth] Unexpected error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
