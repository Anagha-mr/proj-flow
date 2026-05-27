/**
 * Sprint 15 — Navigation utilities
 * Route label lookup and breadcrumb computation for the V5 shell.
 */

export const ROUTE_LABELS: Record<string, string> = {
  // Studio-level
  dashboard:   "Dashboard",
  projects:    "Projects",
  clients:     "Clients",
  team:        "Team",
  tasks:       "Tasks",
  documents:   "Documents",
  vendors:     "Vendors",
  finance:     "Finance",
  portfolio:   "Portfolio",
  contractors: "Contractors",
  settings:    "Settings",
  studio:      "Studio",
  marketing:   "Marketing",
  // Project sub-routes
  overview:     "Overview",
  timeline:     "Timeline",
  moodboard:    "Moodboard",
  spec:         "Specifications",
  procurement:  "Schedules",
  approvals:    "Approvals",
  financial:    "Financial",
  orders:       "Orders",
  site:         "Site Updates",
  rfi:          "RFIs",
  snag:         "Snag List",
  time:         "Time",
  meetings:     "Meetings",
}

export interface Breadcrumb {
  label: string
  href: string
}

/**
 * Parses a pathname into an ordered breadcrumb list.
 * Substitutes project UUIDs with the projectName when provided.
 *
 * Examples:
 *   /dashboard                        → [Dashboard]
 *   /dashboard/projects               → [Projects]
 *   /dashboard/projects/[id]/tasks    → [Projects, ProjectName, Design, Tasks]
 */
export function getBreadcrumbs(
  pathname: string,
  projectName?: string | null,
): Breadcrumb[] {
  // Strip leading slash and split
  const parts = pathname.replace(/^\//, "").split("/").filter(Boolean)
  // e.g. ["dashboard", "projects", "abc-uuid", "tasks"]

  const crumbs: Breadcrumb[] = []
  let href = ""

  // UUID regex — identifies project ID segments
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    href += `/${part}`

    if (UUID_RE.test(part)) {
      // Replace UUID with project name
      if (projectName) {
        crumbs.push({ label: projectName, href })
      }
      // Skip UUID segment — label already added
    } else {
      const label = ROUTE_LABELS[part]
      if (label) {
        // Skip "dashboard" as its own crumb — redundant with the logo
        if (part === "dashboard" && i === 0) continue
        crumbs.push({ label, href })
      }
    }
  }

  return crumbs
}
