import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const AUTH_ROUTES = ["/login", "/signup"]
const PUBLIC_ROUTES = ["/login", "/signup", "/onboarding"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Token-based external routes bypass auth entirely
  if (
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/contractor/") ||
    pathname.startsWith("/vendor/") ||
    pathname.startsWith("/share/moodboard/") ||
    pathname.startsWith("/api/canva/callback") ||
    pathname.startsWith("/api/moodboards/approve") ||
    pathname.startsWith("/api/stage-payment/confirm") ||
    pathname.startsWith("/api/razorpay/webhook")
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Redirect authenticated users away from auth pages → dashboard
  if (user && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
