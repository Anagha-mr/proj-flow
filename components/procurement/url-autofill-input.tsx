"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, AlertCircle, Link as LinkIcon, X } from "lucide-react"
import type { ExtractedProduct } from "@/app/actions/product-discovery"

interface URLAutofillInputProps {
  onExtracted: (product: ExtractedProduct) => void
  onClear: () => void
}

type ExtractionState = "idle" | "loading" | "success" | "error"

const RETAILER_BADGES: Array<{ match: string; label: string; className: string }> = [
  { match: "amazon.in", label: "amazon.in", className: "bg-orange-900/30 text-orange-300" },
  { match: "pepperfry.com", label: "pepperfry.com", className: "bg-amber-900/30 text-amber-300" },
  { match: "ikea.com", label: "ikea.com/in", className: "bg-blue-900/30 text-blue-300" },
  { match: "urbanladder.com", label: "urbanladder.com", className: "bg-purple-900/30 text-purple-300" },
]

function getRetailerBadge(sourceUrl: string): { label: string; className: string } {
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "")
    for (const r of RETAILER_BADGES) {
      if (hostname.includes(r.match)) return { label: r.label, className: r.className }
    }
    return { label: hostname, className: "bg-muted text-muted-foreground" }
  } catch {
    return { label: "unknown", className: "bg-muted text-muted-foreground" }
  }
}

export function URLAutofillInput({ onExtracted, onClear }: URLAutofillInputProps) {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<ExtractionState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [extracted, setExtracted] = useState<ExtractedProduct | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [slowLoad, setSlowLoad] = useState(false)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function triggerExtract(rawUrl: string) {
    const trimmed = rawUrl.trim()
    if (!trimmed) return

    // Optimistic — show spinner immediately (< 50ms)
    setState("loading")
    setSlowLoad(false)
    setErrorMsg("")
    setExtracted(null)

    slowTimer.current = setTimeout(() => setSlowLoad(true), 8000)

    try {
      const res = await fetch("/api/product/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const result = await res.json()

      if (slowTimer.current) clearTimeout(slowTimer.current)
      setSlowLoad(false)

      if (result.success && result.product) {
        setExtracted(result.product as ExtractedProduct)
        setIsCached(result.cached === true)
        setState("success")
        onExtracted(result.product as ExtractedProduct)
      } else {
        setErrorMsg(result.error ?? "Could not extract product details")
        setState("error")
      }
    } catch {
      if (slowTimer.current) clearTimeout(slowTimer.current)
      setSlowLoad(false)
      setErrorMsg("Could not extract product details. Please fill in manually.")
      setState("error")
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text")
    if (pasted.startsWith("http")) {
      // Let the input value update first, then trigger
      setTimeout(() => triggerExtract(pasted), 0)
    }
  }

  function handleClear() {
    setUrl("")
    setState("idle")
    setExtracted(null)
    setErrorMsg("")
    setSlowLoad(false)
    if (slowTimer.current) clearTimeout(slowTimer.current)
    onClear()
  }

  const badge = extracted ? getRetailerBadge(extracted.source_url) : null

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Product URL (optional)</label>

      {/* URL input */}
      <div className="relative flex items-center">
        <LinkIcon className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={handlePaste}
          disabled={state === "loading"}
          placeholder="Paste product URL to auto-fill…"
          className="pl-9 pr-8 focus-visible:ring-[#e94560] text-sm"
        />
        {url && state !== "loading" && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear URL"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading state */}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#e94560]" />
          <span>Fetching product details…</span>
          {slowLoad && (
            <span className="text-amber-500 ml-1">Taking longer than usual…</span>
          )}
        </div>
      )}

      {/* Success state */}
      {state === "success" && extracted && (
        <div className="flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle className="w-3.5 h-3.5 text-[#1D9E75] shrink-0" />
            <span className="text-xs text-[#1D9E75] font-medium">Product found</span>
            {badge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {isCached && (
              <span className="text-[10px] text-muted-foreground">⚡ Loaded from cache</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors shrink-0"
          >
            Clear URL
          </button>
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[#e94560] shrink-0" />
            <span className="text-xs text-[#e94560]">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => triggerExtract(url)}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors shrink-0 ml-2"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
