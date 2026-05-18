"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/PermissionGate"
import { Plus, Star, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Vendor } from "@/app/actions/vendors"
import type { PurchaseOrder } from "@/app/actions/purchase-orders"
import { deactivateVendor } from "@/app/actions/vendors"
import { AddEditVendorSheet } from "./add-edit-vendor-sheet"
import { VendorDetailPanel } from "./vendor-detail-panel"
import { PurchaseOrdersSection } from "./purchase-orders-section"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const VENDOR_TYPES = ['furniture', 'tiles', 'lighting', 'textiles', 'sanitaryware', 'hardware', 'other'] as const
const TYPE_LABELS: Record<string, string> = {
  furniture: 'Furniture', tiles: 'Tiles', lighting: 'Lighting',
  textiles: 'Textiles', sanitaryware: 'Sanitaryware', hardware: 'Hardware', other: 'Other',
}

function avgRating(rating: Record<string, number>): number | null {
  const vals = Object.values(rating)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  )
}

interface VendorsPageClientProps {
  vendors: Vendor[]
  purchaseOrders: PurchaseOrder[]
}

export function VendorsPageClient({ vendors: initial, purchaseOrders }: VendorsPageClientProps) {
  const { toast } = useToast()
  const [vendors, setVendors] = useState<Vendor[]>(initial)
  const [tab, setTab] = useState<'vendors' | 'purchase_orders'>('vendors')
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null)
  const [userRole, setUserRole] = useState("designer")
  const [projects, setProjects] = useState<Array<{ id: string; name: string; address_line1: string | null }>>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: projectRows }] = await Promise.all([
        supabase.from("users").select("role, studio_id").eq("id", user.id).single(),
        supabase.from("projects").select("id, name, address_line1").eq("status", "active"),
      ])
      if (profile?.role) setUserRole(profile.role)
      setProjects((projectRows ?? []) as Array<{ id: string; name: string; address_line1: string | null }>)
    }
    load()
  }, [])

  const filtered = vendors.filter((v) => {
    if (!showInactive && !v.is_active) return false
    if (typeFilter && v.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!v.name.toLowerCase().includes(q) && !(v.contact_name?.toLowerCase().includes(q) ?? false)) return false
    }
    return true
  })

  function handleVendorSaved(saved: Vendor) {
    setVendors((prev) => {
      const exists = prev.find((v) => v.id === saved.id)
      return exists ? prev.map((v) => v.id === saved.id ? saved : v) : [saved, ...prev]
    })
  }

  async function handleDeactivate(vendor: Vendor) {
    if (!confirm(`Deactivate ${vendor.name}?`)) return
    try {
      await deactivateVendor(vendor.id)
      setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, is_active: false } : v))
      toast({ title: `${vendor.name} deactivated` })
    } catch (err) {
      toast({ title: String(err), variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor profiles, purchase orders, and quote requests</p>
        </div>
        {tab === 'vendors' && (
          <PermissionGate action="manage_vendors">
            <Button onClick={() => setAddOpen(true)} className="bg-[#e94560] hover:bg-[#c73652]">
              <Plus className="w-4 h-4 mr-1" /> Add Vendor
            </Button>
          </PermissionGate>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 border-b">
        {(['vendors', 'purchase_orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[#e94560] text-[#e94560]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'vendors' ? 'Vendors' : 'Purchase Orders'}
          </button>
        ))}
      </div>

      {tab === 'vendors' ? (
        <>
          {/* Search + filters */}
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Search by name or contact…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2 flex-wrap items-center">
              {(['', ...VENDOR_TYPES] as string[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${typeFilter === type ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'text-muted-foreground border-gray-200 hover:border-gray-400'}`}
                >
                  {type === '' ? 'All' : TYPE_LABELS[type]}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2 cursor-pointer">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Show inactive
              </label>
            </div>
          </div>

          {/* Vendor grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl gap-3">
              <p className="text-muted-foreground text-sm">No vendors yet. Add your first vendor to start tracking quotes, purchase orders, and deliveries.</p>
              <PermissionGate action="manage_vendors">
                <Button size="sm" onClick={() => setAddOpen(true)} className="bg-[#e94560] hover:bg-[#c73652]">
                  <Plus className="w-4 h-4 mr-1" /> Add Vendor
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((vendor) => {
                const avg = avgRating(vendor.rating_by_category)
                return (
                  <div
                    key={vendor.id}
                    className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setDetailVendor(vendor)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{vendor.name}</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${vendor.is_active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {TYPE_LABELS[vendor.type] ?? vendor.type}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 hover:bg-muted rounded mt-0.5">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditVendor(vendor) }}>Edit</DropdownMenuItem>
                          {vendor.is_active && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeactivate(vendor) }} className="text-red-600">
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{vendor.contact_name ?? '—'}</span>
                      <span className="text-muted-foreground text-xs">{vendor.phone ?? ''}</span>
                    </div>

                    {avg !== null && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Stars rating={avg} />
                        <span className="text-xs text-muted-foreground">{avg.toFixed(1)}</span>
                      </div>
                    )}

                    {!vendor.is_active && (
                      <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <PurchaseOrdersSection
          initialPOs={purchaseOrders}
          vendors={vendors}
          projects={projects}
          userRole={userRole}
        />
      )}

      {/* Modals */}
      <AddEditVendorSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        userRole={userRole}
        onSaved={handleVendorSaved}
      />

      <AddEditVendorSheet
        open={!!editVendor}
        onOpenChange={(open) => { if (!open) setEditVendor(null) }}
        vendor={editVendor}
        userRole={userRole}
        onSaved={handleVendorSaved}
      />

      <VendorDetailPanel
        vendor={detailVendor}
        purchaseOrders={purchaseOrders}
        userRole={userRole}
        onClose={() => setDetailVendor(null)}
        onEdit={(v) => { setDetailVendor(null); setEditVendor(v) }}
      />
    </div>
  )
}
