"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, FolderOpen } from "lucide-react"
import { ProjectCard } from "./project-card"
import { deleteProject, updateProject } from "@/app/actions/projects"
import { useToast } from "@/hooks/use-toast"

type Project = Awaited<ReturnType<typeof import("@/app/actions/projects").getProjects>>[number]

const STATUS_FILTERS = [
  { label: "All",       value: "all" },
  { label: "Active",    value: "active" },
  { label: "On Hold",   value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Archived",  value: "archived" },
]

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [projects, setProjects] = useState(initialProjects)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      const q = search.toLowerCase()
      const clientName = (p.client as { name?: string } | null)?.name ?? ""
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || clientName.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [projects, statusFilter, search])

  async function handleArchive(id: string) {
    try {
      await updateProject(id, { status: "archived" })
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status: "archived" } : p))
      toast({ title: "Project archived", variant: "default" })
    } catch {
      toast({ title: "Error archiving project", variant: "destructive" })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProject(id)
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status: "archived" } : p))
      toast({ title: "Project deleted", variant: "default" })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete project"
      toast({ title: msg, variant: "destructive" })
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await updateProject(id, { is_pinned: pinned })
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, is_pinned: pinned } : p))
    } catch {
      toast({ title: "Error updating project", variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} {projects.length === 1 ? "project" : "projects"} in your studio
          </p>
        </div>
        <Button asChild style={{ backgroundColor: "#e94560" }} className="hover:opacity-90">
          <Link href="/dashboard/projects/new">
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects or clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 focus-visible:ring-[#e94560]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-[#1a1a2e] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState hasProjects={projects.length > 0} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onArchive={() => handleArchive(project.id)}
              onDelete={() => handleDelete(project.id)}
              onPin={(pinned) => handlePin(project.id, pinned)}
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ hasProjects }: { hasProjects: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="p-6 rounded-full bg-muted">
        <FolderOpen className="w-12 h-12 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">
          {hasProjects ? "No projects match your filter" : "No projects yet"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {hasProjects
            ? "Try adjusting the filters or search term."
            : "Create your first project to get started."}
        </p>
      </div>
      {!hasProjects && (
        <Button asChild style={{ backgroundColor: "#e94560" }} className="hover:opacity-90">
          <Link href="/dashboard/projects/new">
            <Plus className="w-4 h-4" />
            Create your first project
          </Link>
        </Button>
      )}
    </div>
  )
}

export function ProjectsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <div className="p-4 flex flex-col gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
