import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import type { PurchaseOrder } from "@/app/actions/purchase-orders"
import { POConfirmButton } from "./po-confirm-button"
import { format } from "date-fns"

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PublicPOPage({ params }: PageProps) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .single()

  if (!po || !['sent', 'confirmed_by_vendor'].includes(po.status)) {
    notFound()
  }

  const [{ data: vendor }, { data: studio }] = await Promise.all([
    supabase.from("vendors").select("name, showroom_address, gstin").eq("id", po.vendor_id).single(),
    supabase.from("studios").select("name, logo_url, gstin, address_line1, address_line2, postcode").eq("id", po.studio_id).single(),
  ])

  const typedPO = po as PurchaseOrder

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a2e] p-6 text-white flex items-start justify-between">
          <div>
            {studio?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studio.logo_url} alt={studio.name} className="h-10 object-contain mb-2" />
            ) : (
              <p className="font-bold text-lg">{studio?.name ?? 'Studio'}</p>
            )}
            <p className="text-white/60 text-xs">{studio?.address_line1}</p>
            {studio?.gstin && <p className="text-white/60 text-xs">GSTIN: {studio.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">PURCHASE ORDER</p>
            <p className="text-white/80 text-sm mt-1">PO No: {typedPO.po_number}</p>
            <p className="text-white/60 text-xs">Date: {format(new Date(typedPO.po_date), 'd MMM yyyy')}</p>
          </div>
        </div>

        {/* Vendor & delivery */}
        <div className="p-6 grid grid-cols-2 gap-6 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Vendor</p>
            <p className="font-semibold">{vendor?.name}</p>
            {vendor?.showroom_address && <p className="text-sm text-muted-foreground">{vendor.showroom_address}</p>}
            {vendor?.gstin && <p className="text-xs text-muted-foreground">GSTIN: {vendor.gstin}</p>}
          </div>
          <div>
            {typedPO.delivery_address && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Delivery Address</p>
                <p className="text-sm">{typedPO.delivery_address}</p>
              </>
            )}
            {typedPO.expected_delivery_date && (
              <p className="text-sm text-muted-foreground mt-1">
                Expected: {format(new Date(typedPO.expected_delivery_date), 'd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2">#</th>
                <th className="pb-2">Item Name</th>
                <th className="pb-2">Code</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Unit</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">GST</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {typedPO.line_items.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{item.product_code ?? '—'}</td>
                  <td className="py-2 pr-2">{item.quantity}</td>
                  <td className="py-2 pr-2">{item.unit ?? '—'}</td>
                  <td className="py-2 pr-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 pr-2 text-right">{item.gst_rate}%</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 mt-5 text-sm border-t pt-4">
            <div className="flex gap-12"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(typedPO.subtotal)}</span></div>
            <div className="flex gap-12"><span className="text-muted-foreground">GST Total</span><span>{formatCurrency(typedPO.gst_total)}</span></div>
            <div className="flex gap-12 font-bold text-base border-t pt-1.5 mt-0.5">
              <span>Grand Total</span><span>{formatCurrency(typedPO.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {(typedPO.payment_terms?.deposit_amount || typedPO.payment_terms?.balance_amount) && (
          <div className="px-6 pb-4 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payment Terms</p>
            <div className="text-sm flex flex-col gap-1">
              {typedPO.payment_terms.deposit_amount && (
                <p>Deposit: {formatCurrency(typedPO.payment_terms.deposit_amount)}{typedPO.payment_terms.deposit_due_date ? ` due by ${format(new Date(typedPO.payment_terms.deposit_due_date), 'd MMM yyyy')}` : ''}</p>
              )}
              {typedPO.payment_terms.balance_amount && (
                <p>Balance: {formatCurrency(typedPO.payment_terms.balance_amount)}{typedPO.payment_terms.balance_due_date ? ` due by ${format(new Date(typedPO.payment_terms.balance_due_date), 'd MMM yyyy')}` : ''}</p>
              )}
            </div>
          </div>
        )}

        {/* Special instructions */}
        {typedPO.special_instructions && (
          <div className="px-6 pb-4 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Special Instructions</p>
            <p className="text-sm whitespace-pre-wrap">{typedPO.special_instructions}</p>
          </div>
        )}

        {/* Confirm button */}
        <div className="px-6 pb-6 pt-2">
          <POConfirmButton poId={id} isConfirmed={typedPO.status === 'confirmed_by_vendor'} />
        </div>

        <div className="text-center text-xs text-muted-foreground pb-4">Powered by ProjectFlow</div>
      </div>
    </div>
  )
}
