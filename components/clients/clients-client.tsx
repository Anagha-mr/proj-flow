"use client"

import { useState } from "react"
import { Plus, Search, User, Mail, Phone, MessageCircle, ExternalLink, RefreshCw, Trash2, Pencil, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { hasPermission } from "@/lib/permissions"
import type { StudioRole } from "@/lib/supabase/types"
import { regeneratePortalToken, deleteClient } from "@/app/actions/projects"
import { AddClientSheet } from "./add-client-sheet"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientRow = Record<string, any>

interface ClientsClientProps {
  initialClients: ClientRow[]
  currentUserRole: string
}

export function ClientsClient({ initialClients, currentUserRole }: ClientsClientProps) {
  const { toast } = useToast()
  const role = currentUserRole as StudioRole
  const canManage = hasPermission(role, "manage_clients")

  const [clients, setClients] = useState<ClientRow[]>(initialClients)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editClient, setEditClient] = useState<ClientRow | null>(null)
  const [regenerateDialog, setRegenerateDialog] = useState<{ clientId: string; name: string; newToken?: string } | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

  function handleSaved(client: ClientRow) {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...prev[idx], ...client }
        return next
      }
      return [client, ...prev]
    })
  }

  async function handleRegenerate(clientId: string) {
    setRegenerating(true)
    try {
      const newToken = await regeneratePortalToken(clientId)
      const newUrl = `${window.location.origin}/portal/${newToken}`
      setRegenerateDialog((prev) => prev ? { ...prev, newToken: newUrl } : null)
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDelete(clientId: string) {
    try {
      await deleteClient(clientId)
      setClients((prev) => prev.filter((c) => c.id !== clientId))
      toast({ title: "Client deleted" })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Client profiles, portal links, and communication log</p>
        </div>
        {canManage && (
          <Button
            className="bg-[#e94560] hover:bg-[#c73652] text-white"
            onClick={() => { setEditClient(null); setShowAdd(true) }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Client
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search clients by name, company, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl text-center">
          <User className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{search ? "No clients match your search." : "No clients yet."}</p>
          {!search && canManage && (
            <p className="text-xs text-muted-foreground mt-1">Add your first client.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <div key={client.id} className="bg-white border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1a1a2e] truncate">{client.name}</p>
                  {client.company && (
                    <p className="text-sm text-gray-500 truncate">{client.company}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManage && (
                      <DropdownMenuItem onClick={() => { setEditClient(client); setShowAdd(true) }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                    )}
                    {client.portal_token && (
                      <DropdownMenuItem onClick={() => window.open(`/portal/${client.portal_token}`, "_blank")}>
                        <ExternalLink className="w-3.5 h-3.5 mr-2" /> View Portal
                      </DropdownMenuItem>
                    )}
                    {canManage && (
                      <DropdownMenuItem onClick={() => setRegenerateDialog({ clientId: client.id, name: client.name })}>
                        <RefreshCw className="w-3.5 h-3.5 mr-2" /> Regenerate Portal Link
                      </DropdownMenuItem>
                    )}
                    {canManage && (
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col gap-1.5">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone_primary && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span>{client.phone_primary}</span>
                  </div>
                )}
                {client.whatsapp_number && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MessageCircle className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span>{client.whatsapp_number}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {client.project_count ?? 0} project{(client.project_count ?? 0) !== 1 ? "s" : ""}
                </span>
                {(client.outstanding_invoices ?? 0) > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {client.outstanding_invoices} outstanding invoice{client.outstanding_invoices !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddClientSheet
        open={showAdd}
        onOpenChange={(v) => { setShowAdd(v); if (!v) setEditClient(null) }}
        editClient={editClient}
        onSaved={handleSaved}
      />

      {/* Regenerate portal link dialog */}
      <Dialog open={!!regenerateDialog} onOpenChange={(v) => { if (!v) setRegenerateDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Portal Link</DialogTitle>
            <DialogDescription>
              Generate a new portal link for <strong>{regenerateDialog?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {!regenerateDialog?.newToken ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-red-600 font-medium">
                ⚠ The previous portal link will immediately stop working.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#e94560] hover:bg-[#c73652] text-white"
                  disabled={regenerating}
                  onClick={() => regenerateDialog && handleRegenerate(regenerateDialog.clientId)}
                >
                  {regenerating ? "Generating…" : "Generate New Link"}
                </Button>
                <Button variant="outline" onClick={() => setRegenerateDialog(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-green-700 font-medium">New link generated successfully.</p>
              <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-3">
                <span className="text-xs text-gray-700 truncate flex-1 font-mono">{regenerateDialog.newToken}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(regenerateDialog.newToken!)
                    toast({ title: "Link copied" })
                  }}
                >
                  Copy
                </Button>
              </div>
              <Button onClick={() => setRegenerateDialog(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
