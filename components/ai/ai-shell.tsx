"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { AIPanel, AITriggerButton } from "./ai-panel"

interface AIShellProps {
  aiEnabled: boolean
}

export function AIShell({ aiEnabled }: AIShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Extract projectId and projectName from URL path
  // URL pattern: /dashboard/projects/[id]/...
  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null

  // Keyboard shortcut: Cmd/Ctrl+I
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  if (!aiEnabled) return null

  return (
    <>
      <AITriggerButton isOpen={open} onClick={() => setOpen((v) => !v)} />
      <AIPanel
        isOpen={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
        projectName={null}
      />
    </>
  )
}
