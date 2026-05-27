"use client"

import React from "react"

/**
 * Sprint 15 — V5 Collapsible Two-Layer Sidebar
 *
 * Studio layer:  always visible, 11 top-level nav items
 * Project layer: injected below studio nav when inside /dashboard/projects/[id]/*
 *
 * Collapse state: localStorage key "pf_sidebar_collapsed"
 * Project group collapse: localStorage key "pf_project_nav_collapsed"
 * Sub-group collapse:     localStorage key "pf_nav_group_{groupName}"
 */

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FolderOpen, Users, UserSquare2, CheckSquare,
  FileText, Package, TrendingUp, Image, HardHat, Settings,
  ChevronLeft, ChevronRight, ChevronDown, Circle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useSidebar } from "./sidebar-context"
import { getProjectName } from "@/app/actions/projects"

// ─── Studio nav items ─────────────────────────────────────────────────────────
const STUDIO_NAV = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Dashboard"   },
  { href: "/dashboard/projects",    icon: FolderOpen,      label: "Projects"    },
  { href: "/dashboard/clients",     icon: Users,           label: "Clients"     },
  { href: "/dashboard/team",        icon: UserSquare2,     label: "Team"        },
  { href: "/dashboard/tasks",       icon: CheckSquare,     label: "Tasks"       },
  { href: "/dashboard/documents",   icon: FileText,        label: "Documents"   },
  { href: "/dashboard/vendors",     icon: Package,         label: "Vendors"     },
  { href: "/dashboard/finance",     icon: TrendingUp,      label: "Finance"     },
  { href: "/dashboard/portfolio",   icon: Image,           label: "Portfolio"   },
  { href: "/dashboard/contractors", icon: HardHat,         label: "Contractors" },
  { href: "/dashboard/settings",    icon: Settings,        label: "Settings"    },
] as const

// ─── Project sub-nav groups ───────────────────────────────────────────────────
function buildProjectNav(id: string) {
  return [
    {
      group: "Overview",
      items: [
        { label: "Summary",   href: `/dashboard/projects/${id}/overview` },
        { label: "Timeline",  href: `/dashboard/projects/${id}/timeline` },
      ],
    },
    {
      group: "Design",
      items: [
        { label: "Tasks",          href: `/dashboard/projects/${id}/tasks` },
        { label: "Moodboard",      href: `/dashboard/projects/${id}/moodboard` },
        { label: "Documents",      href: `/dashboard/projects/${id}/documents` },
        { label: "Specifications", href: `/dashboard/projects/${id}/spec` },
      ],
    },
    {
      group: "Procurement",
      items: [
        { label: "Schedules",  href: `/dashboard/projects/${id}/procurement` },
        { label: "Approvals",  href: `/dashboard/projects/${id}/procurement/approvals` },
        { label: "Financial",  href: `/dashboard/projects/${id}/procurement/financial` },
        { label: "Orders",     href: `/dashboard/projects/${id}/orders` },
      ],
    },
    {
      group: "Site",
      items: [
        { label: "Site Updates", href: `/dashboard/projects/${id}/site` },
        { label: "RFIs",         href: `/dashboard/projects/${id}/rfi` },
        { label: "Snag List",    href: `/dashboard/projects/${id}/snag` },
        { label: "Contractors",  href: `/dashboard/projects/${id}/contractors` },
      ],
    },
    {
      group: "Finance",
      items: [
        { label: "Invoices", href: `/dashboard/projects/${id}/finance` },
        { label: "Time",     href: `/dashboard/projects/${id}/time` },
      ],
    },
    {
      group: "Records",
      items: [
        { label: "Meetings",  href: `/dashboard/projects/${id}/meetings` },
        { label: "Portfolio", href: `/dashboard/projects/${id}/portfolio` },
      ],
    },
  ]
}

// ─── UUID regex ───────────────────────────────────────────────────────────────
const UUID_RE = /\/dashboard\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

// ─── Sidebar inner content ────────────────────────────────────────────────────
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebar()

  // Extract project ID from pathname
  const match = pathname.match(UUID_RE)
  const projectId = match?.[1] ?? null

  // Project name (fetched client-side)
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) { setProjectName(null); return }
    getProjectName(projectId).then(setProjectName).catch(() => setProjectName(null))
  }, [projectId])

  // Project section collapse
  const [projectNavCollapsed, setProjectNavCollapsed] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem("pf_project_nav_collapsed")
    if (saved !== null) setProjectNavCollapsed(saved === "true")
  }, [])
  function toggleProjectNav() {
    setProjectNavCollapsed((v) => {
      localStorage.setItem("pf_project_nav_collapsed", String(!v))
      return !v
    })
  }

  // Per-group collapse
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const initial: Record<string, boolean> = {}
    buildProjectNav("").forEach(({ group }) => {
      const saved = localStorage.getItem(`pf_nav_group_${group}`)
      initial[group] = saved === "true"
    })
    setGroupCollapsed(initial)
  }, [])
  function toggleGroup(group: string) {
    setGroupCollapsed((prev) => {
      const next = { ...prev, [group]: !prev[group] }
      localStorage.setItem(`pf_nav_group_${group}`, String(next[group]))
      return next
    })
  }

  const projectNav = projectId ? buildProjectNav(projectId) : []

  // Active check for studio items
  function isStudioActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    // Don't match /dashboard/projects/[id]/* for the top-level Projects item
    if (href === "/dashboard/projects") return pathname === "/dashboard/projects" || pathname === "/dashboard/projects/new"
    return pathname.startsWith(href)
  }

  // Truncate project name for header
  const displayName = projectName
    ? projectName.length > 18 ? projectName.slice(0, 18) + "…" : projectName
    : "Project"

  return (
    <aside
      className={cn(
        "flex flex-col h-full transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
        collapsed ? "w-[52px]" : "w-[232px]"
      )}
      style={{ background: "var(--color-shell, #0D0F1A)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center h-[52px] px-3 shrink-0 relative"
        style={{ borderBottom: "1px solid var(--shell-border)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-md bg-shell-accent flex items-center justify-center text-white font-bold text-xs shrink-0">
              P
            </div>
            <span
              className="font-semibold text-sm tracking-tight truncate transition-opacity duration-100 text-white"
            >
              ProjectFlow
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-md bg-shell-accent flex items-center justify-center text-white font-bold text-xs mx-auto">
            P
          </div>
        )}

        {/* Collapse toggle (desktop only — mobile uses Sheet's built-in X) */}
        {!onClose && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "hidden md:flex items-center justify-center w-5 h-5 rounded transition-colors",
              collapsed ? "mx-auto" : "ml-auto shrink-0"
            )}
            style={{ color: "var(--shell-text-muted)" }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 overflow-x-hidden">
        {/* Studio items */}
        <ul className="flex flex-col gap-0.5 px-1.5">
          {STUDIO_NAV.map((item) => {
            const active = isStudioActive(item.href)
            const hasActiveProject = !!projectId && item.href === "/dashboard/projects"
            const Icon = item.icon

            const linkEl = (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center rounded-[6px] h-9 transition-colors duration-150 relative",
                    collapsed ? "justify-center px-0 w-full" : "gap-[10px] px-3",
                    active
                      ? "border-l-2 border-shell-accent"
                      : "border-l-2 border-transparent"
                  )}
                  style={{
                    background: active ? "var(--shell-accent-muted)" : "transparent",
                    color: active
                      ? "var(--color-shell-accent, #E24B4A)"
                      : "var(--shell-text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "var(--color-shell-surface)"
                      e.currentTarget.style.color = "#fff"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.color = "var(--shell-text-secondary)"
                    }
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium flex-1 truncate transition-opacity duration-100">
                      {item.label}
                    </span>
                  )}
                  {/* Active project dot (collapsed, Projects item) */}
                  {collapsed && hasActiveProject && (
                    <span
                      className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-shell-accent"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            )

            if (collapsed) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-shell-card text-white border-shell-border-emphasis">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return linkEl
          })}
        </ul>

        {/* ── Project section ── */}
        {projectId && !collapsed && (
          <div className="mt-2" style={{ borderTop: "1px solid var(--shell-border)", marginTop: "8px" }}>
            {/* Section header */}
            <button
              onClick={toggleProjectNav}
              className="w-full flex items-center gap-2 px-3 h-7 mt-2"
              style={{ color: "var(--shell-text-muted)" }}
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 shrink-0 transition-transform duration-150 ease-in-out",
                  projectNavCollapsed && "-rotate-90"
                )}
              />
              <span className="text-[10px] font-medium uppercase tracking-wider truncate">
                {displayName}
              </span>
            </button>

            {/* Groups */}
            {!projectNavCollapsed && (
              <div className="mt-1 px-1.5">
                {projectNav.map(({ group, items }) => (
                  <div key={group} className="mb-1">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center gap-1.5 px-2 h-7"
                      style={{ color: "var(--shell-text-muted)" }}
                    >
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 shrink-0 transition-transform duration-150 ease-in-out",
                          groupCollapsed[group] && "-rotate-90"
                        )}
                      />
                      <span className="text-[10px] font-medium uppercase tracking-wider">
                        {group}
                      </span>
                    </button>

                    {/* Sub-items */}
                    {!groupCollapsed[group] && (
                      <ul className="flex flex-col gap-0.5 pl-4">
                        {items.map((sub) => {
                          const subActive = pathname === sub.href ||
                            (sub.href.endsWith("/procurement") && pathname === sub.href)
                          return (
                            <li key={sub.href}>
                              <Link
                                href={sub.href}
                                onClick={onClose}
                                className="flex items-center h-8 px-2 rounded-[6px] text-sm transition-colors duration-150"
                                style={{
                                  color: subActive
                                    ? "var(--color-shell-accent, #E24B4A)"
                                    : "var(--shell-text-secondary)",
                                  fontWeight: subActive ? 500 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (!subActive) {
                                    e.currentTarget.style.background = "var(--color-shell-surface)"
                                    e.currentTarget.style.color = "#fff"
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!subActive) {
                                    e.currentTarget.style.background = "transparent"
                                    e.currentTarget.style.color = "var(--shell-text-secondary)"
                                  }
                                }}
                              >
                                {sub.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active project dot indicator when sidebar IS collapsed */}
        {projectId && collapsed && (
          <div className="flex justify-center mt-2">
            <Circle className="w-1.5 h-1.5 fill-shell-accent text-shell-accent" />
          </div>
        )}
      </nav>
    </aside>
  )
}

// ─── Main export (exported as named export) ────────────────────────────────────
export function Sidebar() {
  const { mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex h-full">
        <SidebarContent />
      </div>

      {/* Mobile — shadcn Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[280px] border-0"
          style={{ background: "var(--color-shell, #0D0F1A)" }}
        >
          {/* Visually-hidden title required by Radix for accessibility */}
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
