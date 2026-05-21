"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, LayoutGrid } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCanvaDesigns, linkExistingCanvaDesign } from "@/app/actions/canva"
import type { CanvaDesign } from "@/app/actions/canva"
import type { Moodboard } from "@/app/actions/moodboards"
import { format } from "date-fns"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  moodboardId: string | null
  onLinked: (m: Moodboard) => void
}

export function DesignPickerSheet({ open, onOpenChange, moodboardId, onLinked }: Props) {
  const { toast } = useToast()
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedId(null)
      setError(null)
      return
    }
    setLoading(true)
    getCanvaDesigns()
      .then((d) => { setDesigns(d); setError(null) })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = designs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  async function handleLink() {
    if (!moodboardId || !selectedId) return
    setLinking(true)
    try {
      const updated = await linkExistingCanvaDesign(moodboardId, selectedId)
      toast({ title: "Design linked" })
      onLinked(updated)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setLinking(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] flex flex-col overflow-hidden p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>Link a Canva Design</SheetTitle>
          </SheetHeader>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search designs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 focus-visible:ring-[#e94560]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <a href="/dashboard/settings" className="text-sm text-[#e94560] hover:underline">
                Go to Settings → Integrations to reconnect Canva
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No designs match your search."
                  : "No designs found in your Canva account. Create a new design in Canva first, then link it here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((design) => (
                <button
                  key={design.id}
                  onClick={() => setSelectedId(design.id === selectedId ? null : design.id)}
                  className={`text-left rounded-lg border overflow-hidden transition-all hover:border-[#e94560] ${
                    design.id === selectedId
                      ? "border-2 border-[#e94560] ring-1 ring-[#e94560]"
                      : "border-gray-200"
                  }`}
                >
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {design.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={design.thumbnail_url}
                        alt={design.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutGrid className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate text-gray-900">{design.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(design.updated_at), "dd MMM yyyy")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-2">
          <Button
            onClick={handleLink}
            disabled={!selectedId || linking}
            className="bg-[#1a1a2e] hover:bg-[#2d2d4e] text-white"
          >
            {linking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Link Design
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
