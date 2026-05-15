"use client"

import { useState } from "react"
import { Building2, Phone, MessageCircle, MoreVertical, Copy, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/PermissionGate"
import { AddContractorSheet } from "./add-contractor-sheet"
import { updateContractor, regenerateContractorToken } from "@/app/actions/contractors"
import { useToast } from "@/hooks/use-toast"
import type { Contractor } from "@/app/actions/contractors"

interface ContractorsClientProps {
  contractors: Contractor[]
}

export function ContractorsClient({ contractors: initial }: ContractorsClientProps) {
  const { toast } = useToast()
  const [contractors, setContractors] = useState(initial)
  const [search, setSearch] = useState("")
  const [showActive, setShowActive] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editContractor, setEditContractor] = useState<Contractor | null>(null)
  const [tokenDialog, setTokenDialog] = useState<{ token: string; companyName: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [deactivateDialog, setDeactivateDialog] = useState<Contractor | null>(null)

  const filtered = contractors.filter((c) => {
    const matchActive = showActive ? c.is_active : true
    const matchSearch = !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.contact_name.toLowerCase().includes(search.toLowerCase())
    return matchActive && matchSearch
  })

  async function handleRegenerateToken(contractor: Contractor) {
    try {
      const newToken = await regenerateContractorToken(contractor.id)
      setTokenDialog({ token: newToken, companyName: contractor.company_name })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  async function handleDeactivate(contractor: Contractor) {
    try {
      await updateContractor(contractor.id, { is_active: false })
      setContractors((prev) => prev.map((c) => c.id === contractor.id ? { ...c, is_active: false } : c))
      toast({ title: `${contractor.company_name} deactivated` })
      setDeactivateDialog(null)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  function handleCopyToken() {
    if (!tokenDialog) return
    navigator.clipboard.writeText(tokenDialog.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contractors</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage contractor profiles and project assignments</p>
        </div>
        <PermissionGate action="manage_contractors">
          <Button onClick={() => { setEditContractor(null); setAddOpen(true) }} className="bg-[#e94560] hover:bg-[#d63850] text-white gap-1.5">
            + Add Contractor
          </Button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contractors…"
          className="w-64 focus-visible:ring-[#e94560]"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowActive(true)}
            className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${showActive ? "bg-[#1a1a2e] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Active
          </button>
          <button
            onClick={() => setShowActive(false)}
            className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${!showActive ? "bg-[#1a1a2e] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-gray-700">No contractors found.</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first contractor to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((contractor) => (
            <ContractorCard
              key={contractor.id}
              contractor={contractor}
              onEdit={() => { setEditContractor(contractor); setAddOpen(true) }}
              onRegenerateToken={() => handleRegenerateToken(contractor)}
              onDeactivate={() => setDeactivateDialog(contractor)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit sheet */}
      <AddContractorSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        editContractor={editContractor}
        onCreated={(c) => setContractors((prev) => [c, ...prev])}
        onUpdated={() => {
          setContractors((prev) => prev.map((c) => c.id === editContractor?.id ? { ...c, ...editContractor } : c))
          toast({ title: "Contractor updated" })
        }}
      />

      {/* Token dialog */}
      <Dialog open={!!tokenDialog} onOpenChange={(v) => { if (!v) { setTokenDialog(null); setCopied(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Contractor Token — {tokenDialog?.companyName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Copy this token and share it with the contractor. This token gives access to the contractor portal.</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-sm bg-gray-100 rounded px-3 py-2 font-mono break-all">{tokenDialog?.token}</code>
            <Button variant="outline" size="icon" onClick={handleCopyToken}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm dialog */}
      <Dialog open={!!deactivateDialog} onOpenChange={(v) => { if (!v) setDeactivateDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Contractor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will hide <strong>{deactivateDialog?.company_name}</strong> from future project assignments.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeactivateDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deactivateDialog && handleDeactivate(deactivateDialog)}>Deactivate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContractorCard({
  contractor, onEdit, onRegenerateToken, onDeactivate,
}: {
  contractor: Contractor
  onEdit: () => void
  onRegenerateToken: () => void
  onDeactivate: () => void
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 ${!contractor.is_active ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{contractor.company_name}</p>
          {contractor.company_type && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium mt-1 inline-block">
              {contractor.company_type}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onRegenerateToken}>Regenerate Token</DropdownMenuItem>
            {contractor.is_active && (
              <DropdownMenuItem onClick={onDeactivate} className="text-destructive focus:text-destructive">Deactivate</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <p className="text-gray-700 font-medium">{contractor.contact_name}</p>
        {contractor.phone && (
          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{contractor.phone}</span>
        )}
        {contractor.whatsapp_number && (
          <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" />{contractor.whatsapp_number}</span>
        )}
      </div>

      {!contractor.is_active && (
        <span className="text-xs text-muted-foreground italic">Deactivated</span>
      )}
    </div>
  )
}
