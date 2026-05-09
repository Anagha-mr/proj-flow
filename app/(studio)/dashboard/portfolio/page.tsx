import type { Metadata } from "next"

export const metadata: Metadata = { title: "Portfolio" }

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">All projects grid, cross-project timeline, and resource allocation map</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Portfolio management coming in Phase 2
      </div>
    </div>
  )
}
