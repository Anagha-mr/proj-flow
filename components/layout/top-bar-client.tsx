"use client"

import { Bell, Menu } from "lucide-react"
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
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function TopBarClient({ userName, userRole, userPhotoUrl, studioName }: TopBarClientProps) {
  const { setMobileOpen } = useSidebar()

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
      {/* Left: hamburger (mobile) + studio name */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {studioName && (
          <span className="text-sm font-semibold text-foreground">{studioName}</span>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-7 w-7">
                {userPhotoUrl && <AvatarImage src={userPhotoUrl} alt={userName} />}
                <AvatarFallback className="text-xs">{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium leading-none">{userName}</span>
                <Badge variant="secondary" className="mt-0.5 text-[10px] h-4 px-1">
                  {STUDIO_ROLES[userRole]}
                </Badge>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">{userName}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {STUDIO_ROLES[userRole]}
              </span>
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
