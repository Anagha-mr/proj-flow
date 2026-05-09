import type { Metadata } from "next"

export const metadata: Metadata = { title: "Marketing" }

export default function MarketingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground mt-1">Social scheduler, Instagram grid planner, and blog templates</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Marketing tools coming in Phase 3
      </div>
    </div>
  )
}
