"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, FolderOpen, CheckSquare, FileText, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getSearchIndex, type SearchIndex } from "@/app/actions/projects"
import { useSidebar } from "./sidebar-context"

function highlight(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-shell-accent/20 text-shell-accent rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useSidebar()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [loading, setLoading] = useState(false)

  // Open on Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setCommandOpen])

  // Fetch index when opened
  useEffect(() => {
    if (!commandOpen) {
      setQuery("")
      return
    }
    if (index) {
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    setLoading(true)
    getSearchIndex()
      .then((data) => { setIndex(data); setTimeout(() => inputRef.current?.focus(), 50) })
      .catch(() => setIndex({ projects: [], tasks: [], documents: [] }))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandOpen])

  const navigate = useCallback((href: string) => {
    router.push(href)
    setCommandOpen(false)
  }, [router, setCommandOpen])

  // Filtered results
  const q = query.toLowerCase().trim()

  const filteredProjects = (index?.projects ?? []).filter((p) =>
    !q || p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q)
  ).slice(0, 5)

  const filteredTasks = (index?.tasks ?? []).filter((t) =>
    !q || t.title.toLowerCase().includes(q) || t.project_name.toLowerCase().includes(q)
  ).slice(0, 5)

  const filteredDocs = (index?.documents ?? []).filter((d) =>
    !q || d.name.toLowerCase().includes(q) || d.project_name.toLowerCase().includes(q)
  ).slice(0, 5)

  const hasResults = filteredProjects.length + filteredTasks.length + filteredDocs.length > 0

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-[560px] overflow-hidden border-0"
        style={{ background: "var(--color-shell-card, #111320)", borderColor: "var(--shell-border-emphasis)" }}
      >
        {/* Accessibility: visually-hidden title required by Radix Dialog */}
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--shell-border-emphasis)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--shell-text-secondary)" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, documents…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--shell-text-muted)]"
            style={{ color: "var(--color-shell-text, #fff)" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setCommandOpen(false) }}
          />
          <kbd
            className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
            style={{ color: "var(--shell-text-muted)", borderColor: "var(--shell-border-emphasis)" }}
          >
            Esc
          </kbd>
          <button onClick={() => setCommandOpen(false)} style={{ color: "var(--shell-text-secondary)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[400px] py-2">
          {loading && (
            <>
              {["Projects", "Tasks", "Documents"].map((group) => (
                <div key={group} className="px-4 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--shell-text-muted)" }}>
                    {group}
                  </p>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-md mb-1 bg-shell-surface/50" />
                  ))}
                </div>
              ))}
            </>
          )}

          {!loading && index && !hasResults && q && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--shell-text-muted)" }}>
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && index && !hasResults && !q && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--shell-text-muted)" }}>
              Start typing to search…
            </p>
          )}

          {/* Projects group */}
          {!loading && filteredProjects.length > 0 && (
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--shell-text-muted)" }}>
                Projects
              </p>
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/dashboard/projects/${p.id}/overview`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{ color: "var(--shell-text-secondary)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-shell-surface)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                >
                  <FolderOpen className="w-4 h-4 shrink-0 text-shell-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white">
                      {highlight(p.name, query)}
                    </p>
                    {p.client_name && (
                      <p className="text-xs truncate" style={{ color: "var(--shell-text-muted)" }}>
                        {p.client_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tasks group */}
          {!loading && filteredTasks.length > 0 && (
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--shell-text-muted)" }}>
                Tasks
              </p>
              {filteredTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/dashboard/projects/${t.project_id}/tasks`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{ color: "var(--shell-text-secondary)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-shell-surface)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                >
                  <CheckSquare className="w-4 h-4 shrink-0" style={{ color: "var(--shell-text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white">
                      {highlight(t.title, query)}
                    </p>
                    {t.project_name && (
                      <p className="text-xs truncate" style={{ color: "var(--shell-text-muted)" }}>
                        {t.project_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Documents group */}
          {!loading && filteredDocs.length > 0 && (
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--shell-text-muted)" }}>
                Documents
              </p>
              {filteredDocs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/dashboard/projects/${d.project_id}/documents`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{ color: "var(--shell-text-secondary)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-shell-surface)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                >
                  <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--shell-text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-white">
                      {highlight(d.name, query)}
                    </p>
                    {d.project_name && (
                      <p className="text-xs truncate" style={{ color: "var(--shell-text-muted)" }}>
                        {d.project_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
