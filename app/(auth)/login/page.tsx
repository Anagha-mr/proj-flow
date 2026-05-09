import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Sign In" }

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
          <span className="text-primary-foreground font-bold text-lg">P</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your ProjectFlow studio</p>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-muted-foreground">
        New to ProjectFlow?{" "}
        <a href="/signup" className="text-primary hover:underline font-medium">
          Create your studio
        </a>
      </p>
    </div>
  )
}
