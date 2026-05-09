import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, CheckSquare, Users, Wallet } from "lucide-react"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("name, studio:studios(name, plan_tier)")
    .eq("id", user!.id)
    .single()

  const studioName = (profile?.studio as { name?: string } | null)?.name ?? "Your Studio"
  const firstName = profile?.name?.split(" ")[0] ?? "there"

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good morning, {firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{studioName} — here's your studio at a glance</p>
      </div>

      {/* Stat cards — will be dynamic in later sprints */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderOpen} label="Active Projects" value="—" color="bg-primary/10 text-primary" />
        <StatCard icon={CheckSquare} label="Tasks Due Today" value="—" color="bg-warning/10 text-warning" />
        <StatCard icon={Users} label="Team Members" value="—" color="bg-success/10 text-success" />
        <StatCard icon={Wallet} label="Outstanding (₹)" value="—" color="bg-destructive/10 text-destructive" />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Task management is coming in Sprint 3. Start by creating your first project.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed will populate once you add projects and team members.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
