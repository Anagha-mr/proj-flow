"use client"

import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Bell, Menu, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { STUDIO_ROLES } from "@/lib/constants"
import { logoutAction } from "@/lib/actions/auth"
import { useSidebar } from "./sidebar-context"
import { getBreadcrumbs } from "@/lib/utils/nav"
import { getProjectName } from "@/app/actions/projects"
import type { StudioRole } from "@/lib/supabase/types"

interface TopBarClientProps {
  userName: string
  userRole: StudioRole
  userPhotoUrl: string | null
  studioName: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const UUID_RE = /\/dashboard\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

export function TopBarClient({ userName, userRole, userPhotoUrl, studioName }: TopBarClientProps) {
  const { setMobileOpen, setCommandOpen } = useSidebar()
  const pathname = usePathname()
  const [projectName, setProjectName] = useState<string | null>(null)

  // Fetch project name for breadcrumb
  const projectMatch = pathname.match(UUID_RE)
  const projectId = projectMatch?.[1] ?? null

  useEffect(() => {
    if (!projectId) { setProjectName(null); return }
    getProjectName(projectId).then(setProjectName).catch(() => setProjectName(null))
  }, [projectId])

  const crumbs = getBreadcrumbs(pathname, projectName)

  return (
    <header
      className="h-[52px] flex items-center justify-between px-4 shrink-0"
      style={{
        background: "var(--color-shell, #0D0F1A)",
        borderBottom: "1px solid var(--shell-border)",
      }}
    >
      {/* Left: hamburger (mobile) + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="md:hidden p-1 rounded-md transition-colors"
          style={{ color: "var(--shell-text-secondary)" }}
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
          {crumbs.length === 0 && studioName && (
            <span className="font-medium text-white truncate">{studioName}</span>
          )}
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={crumb.href} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <span className="text-xs shrink-0" style={{ color: "var(--shell-text-muted)" }}>
                    ›
                  </span>
                )}
                {isLast ? (
                  <span className="font-medium truncate text-white">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate transition-colors"
                    style={{ color: "var(--shell-text-secondary)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#fff" }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--shell-text-secondary)" }}
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>
      </div>

      {/* Right: search + notifications + user */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search / Command Palette */}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-sm"
          style={{
            color: "var(--shell-text-secondary)",
            background: "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-shell-surface)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
          aria-label="Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
          <kbd
            className="hidden sm:inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border"
            style={{ color: "var(--shell-text-muted)", borderColor: "var(--shell-border-emphasis)" }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          style={{ color: "var(--shell-text-secondary)" }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-shell-accent" />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-shell-accent">
              <Avatar className="h-7 w-7">
                {userPhotoUrl && <AvatarImage src={userPhotoUrl} alt={userName} />}
                <AvatarFallback className="text-xs bg-shell-surface text-white">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium leading-none text-white">{userName}</span>
                <Badge variant="secondary" className="mt-0.5 text-[10px] h-4 px-1">
                  {STUDIO_ROLES[userRole]}
                </Badge>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{userName}</span>
              <span className="text-xs text-muted-foreground font-normal">{STUDIO_ROLES[userRole]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/dashboard/studio">My profile</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/dashboard/settings">Settings</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={logoutAction}>
                <button type="submit" className="w-full text-left text-destructive">
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
