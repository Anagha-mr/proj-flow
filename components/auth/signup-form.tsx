"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { signupAction } from "@/lib/actions/auth"

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, null)

  if (state?.success) {
    return (
      <Card>
        <CardContent className="pt-6 text-center flex flex-col gap-3">
          <div className="text-4xl">📬</div>
          <p className="font-semibold">Check your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{state.email}</strong>.
            Click it to activate your account and open your studio.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col gap-3">
        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Your full name</Label>
            <Input id="name" name="name" placeholder="Priya Sharma" autoComplete="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="studio_name">Studio name</Label>
            <Input
              id="studio_name"
              name="studio_name"
              placeholder="Studio Kasa"
              autoComplete="organization"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" placeholder="priya@studiokasa.com" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {state?.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full mt-1">
            {pending ? "Creating studio…" : "Create studio"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline">Terms</a> and{" "}
            <a href="/privacy" className="underline">Privacy Policy</a>.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
