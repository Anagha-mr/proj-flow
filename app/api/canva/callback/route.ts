import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const code = searchParams.get("code")
  const stateRaw = searchParams.get("state")
  const errorParam = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const errorRedirect = new URL("/dashboard/settings?canva=error", request.url)
  const successRedirect = new URL("/dashboard/settings?canva=connected", request.url)

  // Canva returned an error (e.g. user denied, invalid scope)
  if (errorParam) {
    console.error("[canva/callback] Canva returned error:", errorParam, errorDescription)
    return NextResponse.redirect(errorRedirect)
  }

  if (!code || !stateRaw) {
    console.error("[canva/callback] Missing code or state")
    return NextResponse.redirect(errorRedirect)
  }

  // Decode state: base64url({studioId}:{codeVerifier})
  let studioId: string
  let codeVerifier: string
  try {
    const decoded = Buffer.from(
      stateRaw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8")
    const colonIndex = decoded.indexOf(":")
    if (colonIndex === -1) throw new Error("Invalid state format")
    studioId = decoded.slice(0, colonIndex)
    codeVerifier = decoded.slice(colonIndex + 1)
  } catch (err) {
    console.error("[canva/callback] Failed to decode state:", err)
    return NextResponse.redirect(errorRedirect)
  }

  if (!studioId || !codeVerifier) {
    console.error("[canva/callback] Empty studioId or codeVerifier after decode")
    return NextResponse.redirect(errorRedirect)
  }

  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  const redirectUri = process.env.CANVA_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[canva/callback] Missing env vars")
    return NextResponse.redirect(errorRedirect)
  }

  try {
    // Exchange code + verifier for tokens
    // Canva requires Basic auth header: Base64(clientId:clientSecret)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

    const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error("[canva/callback] Token exchange failed:", tokenRes.status, errBody)
      return NextResponse.redirect(errorRedirect)
    }

    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token as string
    const refreshToken = tokens.refresh_token as string
    const expiresIn = (tokens.expires_in as number) ?? 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Fetch Canva user display name
    let canvaUserId = ""
    try {
      const meRes = await fetch("https://api.canva.com/rest/v1/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        canvaUserId = (me.profile?.display_name ?? me.user?.id ?? me.id ?? "") as string
      }
    } catch {
      // non-fatal
    }

    // Use service role client — no session cookie during OAuth redirect
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabase
      .from("studios")
      .update({
        canva_access_token: accessToken,
        canva_refresh_token: refreshToken,
        canva_token_expires_at: expiresAt,
        canva_user_id: canvaUserId || null,
      })
      .eq("id", studioId)

    if (error) {
      console.error("[canva/callback] Failed to save tokens:", error)
      return NextResponse.redirect(errorRedirect)
    }

    console.log("[canva/callback] Success — tokens saved for studio:", studioId)
    return NextResponse.redirect(successRedirect)

  } catch (err) {
    console.error("[canva/callback] Unexpected error:", err)
    return NextResponse.redirect(errorRedirect)
  }
}
