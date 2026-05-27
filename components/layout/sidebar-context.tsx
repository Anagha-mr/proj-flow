"use client"

import { createContext, useContext, useState, useEffect } from "react"

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
  commandOpen: false,
  setCommandOpen: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("pf_sidebar_collapsed")
    if (saved !== null) setCollapsedState(saved === "true")
  }, [])

  function setCollapsed(v: boolean) {
    setCollapsedState(v)
    localStorage.setItem("pf_sidebar_collapsed", String(v))
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen, commandOpen, setCommandOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
