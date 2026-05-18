import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { notifyPOConfirmedByVendor } from "@/app/actions/notifications"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .select("id, status, studio_id, vendor_id, po_number")
      .eq("id", id)
      .single()

    if (error || !po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    }

    if (po.status !== 'sent') {
      return NextResponse.json({ error: "Purchase order is not in sent status" }, { status: 404 })
    }

    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({ status: 'confirmed_by_vendor', vendor_confirmed_at: new Date().toISOString() })
      .eq("id", id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const { data: vendor } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", po.vendor_id)
      .single()

    notifyPOConfirmedByVendor(po.studio_id, po.po_number, vendor?.name ?? "Vendor").catch(() => {})

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
