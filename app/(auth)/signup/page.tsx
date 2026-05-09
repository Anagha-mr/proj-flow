import type { Metadata } from "next"
import { SignupForm } from "@/components/auth/signup-form"

export const metadata: Metadata = { title: "Create Account" }

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
          <span className="text-primary-foreground font-bold text-lg">P</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create your studio</h1>
        <p className="text-sm text-muted-foreground mt-1">Get started with ProjectFlow for free</p>
      </div>
      <SignupForm />
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-primary hover:underline font-medium">
          Sign in
        </a>
      </p>
    </div>
  )
}
