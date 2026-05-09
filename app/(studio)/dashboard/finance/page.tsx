import type { Metadata } from "next"

export const metadata: Metadata = { title: "Finance" }

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground mt-1">Studio P&L, invoices, outstanding payments, and GST summary</p>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed rounded-xl text-muted-foreground text-sm">
        GST invoicing and payment tracking coming in Sprint 6
      </div>
    </div>
  )
}
