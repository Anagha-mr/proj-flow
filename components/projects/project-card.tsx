"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pin, Archive, Trash2, Copy, Pencil } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/hooks/use-toast"

type Project = {
  id: string
  name: string
  type: string
  status: string
  cover_image_url: string | null
  is_pinned: boolean
  updated_at: string
  phases: unknown
  client: { name?: string } | null
  members: Array<{
    user_id: string
    project_role: string
    user: { id: string; name: string; profile_photo_url: string | null } | null
  }>
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  residential: { label: "Residential", className: "bg-indigo-100 text-indigo-700" },
  commercial:  { label: "Commercial",  className: "bg-purple-100 text-purple-700" },
  hospitality: { label: "Hospitality", className: "bg-pink-100 text-pink-700" },
  retail:      { label: "Retail",      className: "bg-orange-100 text-orange-700" },
  other:       { label: "Other",       className: "bg-gray-100 text-gray-600" },
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-green-100 text-green-700" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  className: "bg-gray-100 text-gray-500" },
}

function getPhaseProgress(phases: unknown): number {
  if (!Array.isArray(phases) || phases.length === 0) return 0
  const today = new Date()
  const typed = phases as Array<{ start_date?: string; end_date?: string }>
  const starts = typed.filter((p) => p.start_date).map((p) => new Date(p.start_date!))
  const ends = typed.filter((p) => p.end_date).map((p) => new Date(p.end_date!))
  if (!starts.length || !ends.length) return 0
  const earliest = new Date(Math.min(...starts.map((d) => d.getTime())))
  const latest = new Date(Math.max(...ends.map((d) => d.getTime())))
  const total = latest.getTime() - earliest.getTime()
  if (total <= 0) return 100
  const elapsed = Math.min(today.getTime() - earliest.getTime(), total)
  return Math.max(0, Math.round((elapsed / total) * 100))
}

export function ProjectCard({
  project,
  onArchive,
  onDelete,
  onPin,
  onClick,
}: {
  project: Project
  onArchive: () => void
  onDelete: () => void
  onPin: (pinned: boolean) => void
  onClick: () => void
}) {
  const { toast } = useToast()
  const typeMeta = TYPE_BADGE[project.type] ?? TYPE_BADGE.other
  const statusMeta = STATUS_BADGE[project.status] ?? STATUS_BADGE.active
  const progress = getPhaseProgress(project.phases)
  const clientName = project.client?.name ?? null
  const visibleMembers = (project.members ?? []).slice(0, 3)
  const extraMembers = Math.max(0, (project.members ?? []).length - 3)
  const updatedAgo = formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })

  return (
    <div
      className="rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow group relative"
      onClick={onClick}
    >
      {/* Cover image */}
      <div className="relative h-40 overflow-hidden">
        {project.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e]" />
        )}
        {project.is_pinned && (
          <div className="absolute top-2 left-2 bg-[#e94560] rounded-full p-1">
            <Pin className="w-3 h-3 text-white" />
          </div>
        )}
        {/* 3-dot menu */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {}}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Duplicate — Coming soon" })}
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPin(!project.is_pinned)}>
                <Pin className="w-4 h-4 mr-2" />
                {project.is_pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{project.name}</h3>
            {clientName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{clientName}</p>
            )}
          </div>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        </div>

        <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${typeMeta.className}`}>
          {typeMeta.label}
        </span>

        {/* Phase progress */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex -space-x-2">
            {visibleMembers.map((m) => (
              <Avatar key={m.user_id} className="w-6 h-6 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-[#1a1a2e] text-white">
                  {(m.user?.name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraMembers > 0 && (
              <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                +{extraMembers}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{updatedAgo}</span>
        </div>
      </div>
    </div>
  )
}
