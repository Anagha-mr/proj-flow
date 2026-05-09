"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { loginAction, magicLinkAction } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/client"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginForm() {
  const [loginState, loginAction_, loginPending] = useActionState(loginAction, null)
  const [magicState, magicAction_, magicPending] = useActionState(magicLinkAction, null)

  async function handleGoogleSignIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col gap-4">
        {/* Email + password */}
        <form action={loginAction_} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@studio.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                Forgot?
              </a>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {loginState?.error && (
            <p className="text-xs text-destructive">{loginState.error}</p>
          )}
          <Button type="submit" disabled={loginPending} className="w-full mt-1">
            {loginPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google OAuth */}
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-2"
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        {/* Magic link */}
        <form action={magicAction_} className="flex flex-col gap-2">
          <Input id="magic-email" name="email" type="email" placeholder="Send magic link to your email" autoComplete="off" required />
          {magicState?.error && (
            <p className="text-xs text-destructive">{magicState.error}</p>
          )}
          {magicState?.success && (
            <p className="text-xs text-green-600">Check your email for the magic link!</p>
          )}
          <Button type="submit" variant="outline" disabled={magicPending} className="w-full">
            {magicPending ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
