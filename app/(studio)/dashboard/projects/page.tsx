import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export const metadata: Metadata = { title: "Projects" }

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all your active and archived projects</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          New project
        </Button>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Project creation wizard coming in Sprint 2
      </div>
    </div>
  )
}
