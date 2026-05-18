import { NextRequest, NextResponse } from "next/server"
import { submitQuoteResponse } from "@/app/actions/quotes"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { quote_request_id, vendor_id, unit_price } = body

    if (!quote_request_id || !vendor_id || unit_price === undefined || unit_price === null) {
      return NextResponse.json(
        { error: "quote_request_id, vendor_id, and unit_price are required" },
        { status: 400 }
      )
    }

    if (typeof unit_price !== 'number' || unit_price < 0) {
      return NextResponse.json({ error: "unit_price must be a non-negative number" }, { status: 400 })
    }

    await submitQuoteResponse({
      quote_request_id,
      vendor_id,
      unit_price,
      lead_time_days: body.lead_time_days,
      min_order_qty: body.min_order_qty,
      validity_date: body.validity_date,
      notes: body.notes,
      quote_document_url: body.quote_document_url,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
