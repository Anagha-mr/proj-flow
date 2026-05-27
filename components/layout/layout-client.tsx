"use client"

/**
 * Sprint 15 — Layout Client Wrapper
 *
 * Client boundary component for the studio layout shell.
 * The sidebar and command palette are client components that need
 * access to client-side state (pathname, localStorage, keyboard events).
 *
 * Used composition pattern: TopBar (server component) is rendered
 * by the parent server layout, not inside this client component.
 */

import { Sidebar } from "./sidebar"
import { CommandPalette } from "./command-palette"

interface LayoutClientProps {
  children: React.ReactNode
}

/**
 * Renders the client-side shell: sidebar + command palette.
 * The calling layout renders <TopBar /> separately (server component).
 *
 * Usage in layout.tsx (server):
 *   <SidebarProvider>
 *     <LayoutClient>
 *       <TopBar />     ← server component passed as child
 *       <main>...</main>
 *     </LayoutClient>
 *   </SidebarProvider>
 */
export function LayoutClient({ children }: LayoutClientProps) {
  return (
    <>
      <Sidebar />
      {children}
      <CommandPalette />
    </>
  )
}
