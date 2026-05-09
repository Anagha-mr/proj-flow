import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export const metadata: Metadata = { title: "Contractors" }

export default function ContractorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contractors</h1>
          <p className="text-sm text-muted-foreground mt-1">Contractor profiles, RFI tracker, stage payments, drawing access</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Add contractor
        </Button>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        Contractor management coming in Phase 1
      </div>
    </div>
  )
}
