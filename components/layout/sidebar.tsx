"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  UserCheck,
  HardHat,
  Store,
  Wallet,
  Building2,
  LayoutGrid,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useSidebar } from "./sidebar-context"

const NAV_ITEMS = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Dashboard",   soon: false },
  { href: "/dashboard/projects",    icon: FolderOpen,      label: "Projects",    soon: false },
  { href: "/dashboard/clients",     icon: Users,           label: "Clients",     soon: false },
  { href: "/dashboard/team",        icon: UserCheck,       label: "Team",        soon: false },
  { href: "/dashboard/contractors", icon: HardHat,         label: "Contractors", soon: false },
  { href: "/dashboard/vendors",     icon: Store,           label: "Vendors",     soon: false },
  { href: "/dashboard/finance",     icon: Wallet,          label: "Finance",     soon: false },
  { href: "/dashboard/portfolio",   icon: LayoutGrid,      label: "Portfolio",   soon: false },
  { href: "/dashboard/studio",      icon: Building2,       label: "Studio",      soon: false },
  { href: "/dashboard/marketing",   icon: Megaphone,       label: "Marketing",   soon: true  },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()

  const navContent = (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo / header */}
        <div className={cn(
          "flex items-center h-14 px-4 border-b border-sidebar-border shrink-0",
          collapsed && "justify-center px-0"
        )}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
              P
            </div>
          ) : (
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shrink-0">
                P
              </div>
              <span className="font-semibold text-sm tracking-tight">ProjectFlow</span>
              {/* Mobile close */}
              <button
                className="ml-auto md:hidden text-sidebar-muted hover:text-sidebar-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
              const Icon = item.icon

              const linkEl = (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.soon && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 border-sidebar-border text-sidebar-muted"
                          >
                            Soon
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                      {item.soon && " (Coming soon)"}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return linkEl
            })}
          </ul>
        </nav>

        {/* Settings + collapse */}
        <div className="border-t border-sidebar-border py-3 px-2 flex flex-col gap-0.5">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    "flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                    pathname.startsWith("/dashboard/settings") && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                pathname.startsWith("/dashboard/settings") && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={() => setMobileOpen(false)}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{navContent}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            {navContent}
          </div>
        </>
      )}
    </>
  )
}
