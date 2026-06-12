// Public — handles Google OAuth callback after user grants Calendar access
// CRITICAL: uses service role client — user is not yet in session

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const stateRaw = searchParams.get("state")
  const errorParam = searchParams.get("error")

  const settingsUrl = new URL("/dashboard/settings", req.url)

  if (errorParam || !code || !stateRaw) {
    settingsUrl.searchParams.set("calendar", "error")
    return NextResponse.redirect(settingsUrl)
  }

  let userId: string
  let studioId: string

  try {
    const decoded = JSON.parse(Buffer.from(stateRaw, "base64").toString("utf-8"))
    userId = decoded.userId
    studioId = decoded.studioId
    if (!userId || !studioId) throw new Error("Missing fields")
  } catch {
    settingsUrl.searchParams.set("calendar", "error")
    return NextResponse.redirect(settingsUrl)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI_CALENDAR!,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      settingsUrl.searchParams.set("calendar", "error")
      return NextResponse.redirect(settingsUrl)
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token
    const refreshToken: string = tokenData.refresh_token
    const expiresIn: number = tokenData.expires_in ?? 3600

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Fetch user's Google email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userInfoRes.ok) {
      settingsUrl.searchParams.set("calendar", "error")
      return NextResponse.redirect(settingsUrl)
    }

    const userInfo = await userInfoRes.json()
    const googleEmail: string = userInfo.email

    const supabase = createServiceClient()

    // Upsert calendar_connections (service role bypasses RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (supabase.from as any)("calendar_connections")
      .upsert(
        {
          studio_id: studioId,
          user_id: userId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expiry: tokenExpiry,
          google_calendar_id: "primary",
          google_email: googleEmail,
          is_active: true,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error("calendar_connections upsert error:", upsertError)
      settingsUrl.searchParams.set("calendar", "error")
      return NextResponse.redirect(settingsUrl)
    }

    // Update users.calendar_connected flag
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)("users")
      .update({ calendar_connected: true })
      .eq("id", userId)

    settingsUrl.searchParams.set("calendar", "connected")
    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error("Calendar callback error:", err)
    settingsUrl.searchParams.set("calendar", "error")
    return NextResponse.redirect(settingsUrl)
  }
}
