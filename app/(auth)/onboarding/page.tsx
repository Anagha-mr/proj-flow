import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createStudioAction } from "@/lib/actions/studio"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export const metadata: Metadata = { title: "Create Your Studio" }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // If user already has a studio, skip to dashboard
  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()

  if (profile?.studio_id) redirect("/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
          <span className="text-primary-foreground font-bold text-lg">P</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Name your studio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You can add logo, address, and GSTIN after you're in.
        </p>
      </div>

      <Card>
        <form action={createStudioAction}>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="studio_name">Studio name *</Label>
              <Input
                id="studio_name"
                name="studio_name"
                placeholder="Studio Kasa"
                required
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Create studio &amp; continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
