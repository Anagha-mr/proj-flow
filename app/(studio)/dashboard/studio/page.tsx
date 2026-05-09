import type { Metadata } from "next"

export const metadata: Metadata = { title: "Studio" }

export default function StudioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">Team profiles, payroll, leave tracker, expense claims, and SOPs</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Studio management coming in Phase 2
      </div>
    </div>
  )
}
