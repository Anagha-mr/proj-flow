"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Star } from "lucide-react"
import type { Vendor } from "@/app/actions/vendors"
import type { PurchaseOrder } from "@/app/actions/purchase-orders"
import { getVendorProcurementItems, getVendorQuoteResponses } from "@/app/actions/vendors"
import { formatCurrency, PO_STATUS_BADGE } from "@/components/vendors/vendor-utils"
import { format } from "date-fns"

interface VendorDetailPanelProps {
  vendor: Vendor | null
  purchaseOrders: PurchaseOrder[]
  userRole: string
  onClose: () => void
  onEdit: (vendor: Vendor) => void
}

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
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </span>
  )
}

const CURATION_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  internally_approved: 'bg-green-100 text-green-700',
  quoting: 'bg-blue-100 text-blue-700',
  selected: 'bg-purple-100 text-purple-700',
}

export function VendorDetailPanel({ vendor, purchaseOrders, userRole, onClose, onEdit }: VendorDetailPanelProps) {
  const [bankOpen, setBankOpen] = useState(false)
  const [items, setItems] = useState<Array<{ id: string; name: string; project_name: string; total_cost: number | null; curation_status: string | null }>>([])
  const [quotes, setQuotes] = useState<Array<{ id: string; item_name: string; unit_price: number; submitted_at: string; is_selected: boolean }>>([])
  const [loading, setLoading] = useState(false)

  const isOwner = userRole === 'owner'

  useEffect(() => {
    if (!vendor) return
    setLoading(true)
    Promise.all([
      getVendorProcurementItems(vendor.id),
      getVendorQuoteResponses(vendor.id),
    ]).then(([i, q]) => {
      setItems(i)
      setQuotes(q)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [vendor])

  const vendorPOs = purchaseOrders.filter((po) => po.vendor_id === vendor?.id)
  const avg = vendor ? avgRating(vendor.rating_by_category) : null

  return (
    <Sheet open={!!vendor} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        {vendor && (
          <>
            <SheetHeader className="pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-lg">{vendor.name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline">{TYPE_LABELS[vendor.type] ?? vendor.type}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {avg !== null && <Stars rating={avg} />}
                  </div>
                </div>
                {(userRole === 'owner' || userRole === 'senior_designer') && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(vendor)}>Edit</Button>
                )}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 mt-5">
              {/* Profile */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Profile</p>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  {vendor.contact_name && <><span className="text-muted-foreground">Contact</span><span>{vendor.contact_name}</span></>}
                  {vendor.phone && <><span className="text-muted-foreground">Phone</span><span>{vendor.phone}</span></>}
                  {vendor.email && <><span className="text-muted-foreground">Email</span><span>{vendor.email}</span></>}
                  {vendor.whatsapp_number && <><span className="text-muted-foreground">WhatsApp</span><span>{vendor.whatsapp_number}</span></>}
                  {vendor.gstin && <><span className="text-muted-foreground">GSTIN</span><span>{vendor.gstin}</span></>}
                  {vendor.default_lead_time_days && <><span className="text-muted-foreground">Lead Time</span><span>{vendor.default_lead_time_days} days</span></>}
                </div>
                {vendor.showroom_address && (
                  <div className="mt-2 text-sm"><span className="text-muted-foreground">Address: </span>{vendor.showroom_address}</div>
                )}
                {vendor.notes && (
                  <div className="mt-2 text-sm text-muted-foreground">{vendor.notes}</div>
                )}

                {isOwner && vendor.bank_details && (
                  <Collapsible open={bankOpen} onOpenChange={setBankOpen} className="mt-3">
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bankOpen ? "rotate-180" : ""}`} />
                      Bank Details
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-y-1.5 text-sm mt-2">
                        <span className="text-muted-foreground">Account No.</span><span>{vendor.bank_details.account_number}</span>
                        <span className="text-muted-foreground">IFSC</span><span>{vendor.bank_details.ifsc}</span>
                        <span className="text-muted-foreground">Bank</span><span>{vendor.bank_details.bank_name}</span>
                        <span className="text-muted-foreground">Account Name</span><span>{vendor.bank_details.account_name}</span>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              <Separator />

              {/* Procurement items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Procurement Items</p>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No procurement items linked to this vendor yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.project_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.total_cost !== null && <span className="text-sm">{formatCurrency(item.total_cost)}</span>}
                          {item.curation_status && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${CURATION_BADGE[item.curation_status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {item.curation_status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Quote history */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Quote Responses</p>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : quotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quotes submitted yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {quotes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{q.item_name}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(q.submitted_at), 'd MMM yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatCurrency(q.unit_price)}/unit</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${q.is_selected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {q.is_selected ? 'Selected' : 'Not selected'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* PO history */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Purchase Orders</p>
                {vendorPOs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {vendorPOs.map((po) => {
                      const badge = PO_STATUS_BADGE[po.status]
                      return (
                        <div key={po.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{po.po_number}</p>
                            {po.sent_at && <p className="text-xs text-muted-foreground">Sent {format(new Date(po.sent_at), 'd MMM yyyy')}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatCurrency(po.grand_total)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
