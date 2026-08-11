import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import puppeteer from "puppeteer"

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoiceId")
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Portal token auth path — no session required
  const portalToken = req.nextUrl.searchParams.get("portalToken")
  if (portalToken) {
    const { data: portalClient } = await supabase
      .from("clients")
      .select("id, portal_token_expires_at")
      .eq("portal_token", portalToken)
      .single()

    if (!portalClient) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    if (
      portalClient.portal_token_expires_at &&
      new Date(portalClient.portal_token_expires_at) < new Date()
    ) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { data: portalInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("client_id", portalClient.id)
      .single()

    if (!portalInvoice) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // Fall through to PDF generation with portalInvoice and no studioId check
    return generatePdf(supabase, portalInvoice)
  }

  // Session-based auth path
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()
  if (!profile?.studio_id) return NextResponse.json({ error: "No studio" }, { status: 403 })

  const studioId = profile.studio_id

  // Fetch invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("studio_id", studioId)
    .single()
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  return generatePdf(supabase, invoice)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePdf(supabase: any, invoice: any): Promise<NextResponse> {
  const studioId = invoice.studio_id

  // Fetch studio details
  const { data: studio } = await supabase
    .from("studios")
    .select("name, logo_url, gstin, address_line1, address_line2, address_line3, postcode, bank_details, state_code")
    .eq("id", studioId)
    .single()

  // Fetch client details
  const { data: client } = await supabase
    .from("clients")
    .select("name, address_line1, address_line2, address_line3, postcode, email, state_code")
    .eq("id", invoice.client_id)
    .single()

  // Fetch payments
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("amount, payment_date, bank_reference")
    .eq("invoice_id", invoice.id)
    .eq("studio_id", studioId)

  const lineItems: Array<{
    id: string; description: string; hsn_code: string
    quantity: number; unit: string; unit_rate: number; amount: number
    gst_rate: number; cgst: number; sgst: number; igst: number
  }> = Array.isArray(invoice.line_items) ? (invoice.line_items as unknown as Array<{ id: string; description: string; hsn_code: string; quantity: number; unit: string; unit_rate: number; amount: number; gst_rate: number; cgst: number; sgst: number; igst: number }>) : []

  const isIntraState = lineItems.some((i) => i.cgst > 0)
  const totalCgst = lineItems.reduce((s, i) => s + i.cgst, 0)
  const totalSgst = lineItems.reduce((s, i) => s + i.sgst, 0)
  const totalIgst = lineItems.reduce((s, i) => s + i.igst, 0)

  const bankDetails = studio?.bank_details as Record<string, string> | null
  const studioAddress = [studio?.address_line1, studio?.address_line2, studio?.address_line3, studio?.postcode]
    .filter(Boolean).join(", ")
  const clientAddress = [client?.address_line1, client?.address_line2, client?.address_line3, client?.postcode]
    .filter(Boolean).join(", ")

  const paymentsHtml = (payments ?? []).map((p: { payment_date: string; bank_reference: string | null; amount: number }) =>
    `<tr>
      <td colspan="4" style="padding:4px 0; color:#666; font-size:12px;">
        ${formatDate(p.payment_date)} · ${p.bank_reference ?? ""}
      </td>
      <td style="text-align:right; padding:4px 0; font-size:12px;">${formatINR(p.amount)}</td>
    </tr>`
  ).join("")

  const lineItemsHtml = lineItems.map((item, idx) => {
    const tax = item.cgst + item.sgst + item.igst
    // Invoices issued before Bug #19's fix may not have quantity/unit/unit_rate
    // recorded — fall back to a dash rather than showing "undefined"/NaN.
    const qtyDisplay = item.quantity != null ? String(item.quantity) : "—"
    const unitDisplay = item.unit || "—"
    const rateDisplay = item.unit_rate != null ? formatINR(item.unit_rate) : "—"
    return `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:6px 4px;">${idx + 1}</td>
        <td style="padding:6px 4px;">${item.description}</td>
        <td style="padding:6px 4px;">${item.hsn_code}</td>
        <td style="text-align:right; padding:6px 4px;">${qtyDisplay}</td>
        <td style="padding:6px 4px;">${unitDisplay}</td>
        <td style="text-align:right; padding:6px 4px;">${rateDisplay}</td>
        <td style="text-align:right; padding:6px 4px;">${formatINR(item.amount)}</td>
        <td style="text-align:right; padding:6px 4px;">${item.gst_rate}%</td>
        <td style="text-align:right; padding:6px 4px;">${formatINR(tax)}</td>
        <td style="text-align:right; padding:6px 4px;">${formatINR(item.amount + tax)}</td>
      </tr>`
  }).join("")

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; font-size: 13px; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .studio-name { font-size: 20px; font-weight: bold; }
    .invoice-title { font-size: 18px; font-weight: bold; text-align: right; text-transform: uppercase; letter-spacing: 1px; }
    .meta { color: #555; font-size: 12px; margin-top: 4px; }
    .divider { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
    .bill-to { margin-bottom: 20px; }
    .bill-to-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 4px; font-size: 11px; color: #888; text-transform: uppercase; border-bottom: 2px solid #1a1a2e; }
    th.right { text-align: right; }
    .totals-table { width: 240px; margin-left: auto; margin-top: 16px; }
    .totals-table td { padding: 4px 0; font-size: 13px; }
    .totals-table td.right { text-align: right; }
    .total-row td { font-weight: bold; border-top: 1px solid #1a1a2e; padding-top: 8px; margin-top: 4px; }
    .bank-section { margin-top: 24px; }
    .bank-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 6px; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    .notes { font-size: 12px; color: #555; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${studio?.logo_url ? `<img src="${studio.logo_url}" alt="logo" style="height:60px; margin-bottom:8px; display:block;">` : ""}
      <div class="studio-name">${studio?.name ?? ""}</div>
      ${studioAddress ? `<div class="meta">${studioAddress}</div>` : ""}
      ${studio?.gstin ? `<div class="meta">GSTIN: ${studio.gstin}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div class="invoice-title">Tax Invoice</div>
      <div class="meta" style="margin-top:8px;">Invoice No: ${invoice.invoice_number}</div>
      <div class="meta">Date: ${formatDate(invoice.issue_date)}</div>
      ${invoice.due_date ? `<div class="meta">Due: ${formatDate(invoice.due_date)}</div>` : ""}
    </div>
  </div>

  <hr class="divider">

  <div class="bill-to">
    <div class="bill-to-label">Bill To</div>
    <div style="font-weight:600;">${client?.name ?? ""}</div>
    ${clientAddress ? `<div class="meta">${clientAddress}</div>` : ""}
    ${client?.email ? `<div class="meta">${client.email}</div>` : ""}
  </div>

  <hr class="divider">

  <table style="font-size:11px;">
    <thead>
      <tr>
        <th style="width:22px;">#</th>
        <th>Description</th>
        <th style="width:55px;">HSN</th>
        <th class="right" style="width:34px;">Qty</th>
        <th style="width:50px;">Unit</th>
        <th class="right" style="width:62px;">Rate</th>
        <th class="right" style="width:70px;">Amount</th>
        <th class="right" style="width:38px;">GST%</th>
        <th class="right" style="width:60px;">Tax</th>
        <th class="right" style="width:70px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <table class="totals-table">
    <tbody>
      <tr>
        <td>Subtotal</td>
        <td class="right">${formatINR(invoice.subtotal)}</td>
      </tr>
      ${isIntraState && totalCgst > 0 ? `
      <tr><td>CGST</td><td class="right">${formatINR(totalCgst)}</td></tr>
      <tr><td>SGST</td><td class="right">${formatINR(totalSgst)}</td></tr>
      ` : ""}
      ${!isIntraState && totalIgst > 0 ? `
      <tr><td>IGST</td><td class="right">${formatINR(totalIgst)}</td></tr>
      ` : ""}
      <tr class="total-row">
        <td>Total</td>
        <td class="right">${formatINR(invoice.total)}</td>
      </tr>
    </tbody>
  </table>

  ${bankDetails ? `
  <hr class="divider">
  <div class="bank-section">
    <div class="bank-label">Bank Details</div>
    ${bankDetails.bank_name ? `<div>Bank: ${bankDetails.bank_name}</div>` : ""}
    ${bankDetails.account_number ? `<div>A/c: ${bankDetails.account_number}</div>` : ""}
    ${bankDetails.ifsc ? `<div>IFSC: ${bankDetails.ifsc}</div>` : ""}
  </div>
  ` : ""}

  ${(payments ?? []).length > 0 ? `
  <hr class="divider">
  <div class="bank-label">Payment History</div>
  <table>
    <tbody>${paymentsHtml}</tbody>
  </table>
  ` : ""}

  ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ""}

  <div class="footer">
    Generated by ProjectFlow · ${new Date().toLocaleString("en-IN")} · Confidential
  </div>
</body>
</html>`

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    })
    const pdf = Buffer.from(pdfRaw)
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
      },
    })
  } finally {
    if (browser) await browser.close()
  }
}
