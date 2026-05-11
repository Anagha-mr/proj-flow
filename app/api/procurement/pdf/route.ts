import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import puppeteer from "puppeteer"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get("scheduleId")

  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()

  if (!profile?.studio_id) {
    return NextResponse.json({ error: "No studio found" }, { status: 403 })
  }

  // Fetch schedule
  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("*")
    .eq("id", scheduleId)
    .eq("studio_id", profile.studio_id)
    .single()

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }

  // Fetch items
  const { data: items } = await supabase
    .from("procurement_items")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("is_archived", false)
    .order("position", { ascending: true })

  // Fetch item statuses
  const itemIds = (items ?? []).map((i) => i.id)
  const { data: statusRows } = await supabase
    .from("procurement_item_status")
    .select("*")
    .in("item_id", itemIds)

  const statusMap: Record<string, { client_approval_status: string | null }> = {}
  ;(statusRows ?? []).forEach((s) => { statusMap[s.item_id] = { client_approval_status: s.client_approval_status } })

  // Fetch studio details
  const { data: studio } = await supabase
    .from("studios")
    .select("name, logo_url, gstin, address_line1, address_line2, address_line3, postcode, state_code")
    .eq("id", profile.studio_id)
    .single()

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", schedule.project_id)
    .single()

  const itemList = items ?? []

  // Group items
  const grouped: Record<string, typeof itemList[number][]> = {}
  for (const item of itemList) {
    const key = item.room_or_category || "Uncategorised"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  const updatedAt = new Date(schedule.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  function formatINR(amount: number) {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
  }

  const clientApprovalColour: Record<string, string> = {
    client_review: "#f59e0b",
    approved: "#22c55e",
    rejected: "#ef4444",
    resubmit: "#f97316",
    closed: "#94a3b8",
  }

  // Build item rows HTML per group
  let groupsHtml = ""
  let grandTotal = 0

  for (const [groupName, groupItems] of Object.entries(grouped)) {
    const groupTotal = groupItems.reduce((sum, i) => sum + (i.total_cost ?? 0), 0)
    grandTotal += groupTotal

    let rowsHtml = ""
    for (const item of groupItems) {
      const status = statusMap[item.id]
      const approvalStatus = status?.client_approval_status ?? "client_review"
      const dot = `<span style="color:${clientApprovalColour[approvalStatus] ?? "#94a3b8"}">●</span>`

      rowsHtml += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px;vertical-align:top;">
            ${item.image_url ? `<img src="${item.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" />` : ""}
          </td>
          <td style="padding:8px;vertical-align:top;">
            <div style="font-size:11px;font-weight:600;">${item.name}</div>
            ${item.description ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${item.description.slice(0, 80)}</div>` : ""}
          </td>
          ${schedule.client_can_view_brand !== false ? `<td style="padding:8px;font-size:11px;vertical-align:top;">${item.brand ?? "—"}</td>` : ""}
          <td style="padding:8px;font-size:11px;text-align:center;vertical-align:top;">${item.quantity}</td>
          ${schedule.client_can_view_pricing !== false ? `<td style="padding:8px;font-size:11px;text-align:right;vertical-align:top;">${formatINR(item.unit_cost)}</td>` : ""}
          ${schedule.client_can_view_pricing !== false ? `<td style="padding:8px;font-size:11px;text-align:right;vertical-align:top;font-weight:600;">${formatINR(item.total_cost ?? 0)}</td>` : ""}
          <td style="padding:8px;text-align:center;vertical-align:top;">${dot}</td>
        </tr>
      `
    }

    groupsHtml += `
      <tr style="background:#f8fafc;">
        <td colspan="7" style="padding:8px 8px 4px;font-size:12px;font-weight:700;color:#1a1a2e;">${groupName}</td>
      </tr>
      ${rowsHtml}
      <tr style="background:#f1f5f9;">
        <td colspan="${schedule.client_can_view_pricing !== false ? 5 : 3}" style="padding:6px 8px;font-size:11px;text-align:right;color:#64748b;">Group Total</td>
        ${schedule.client_can_view_pricing !== false ? `<td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:700;">${formatINR(groupTotal)}</td>` : ""}
        <td></td>
      </tr>
    `
  }

  const brandColHeader = schedule.client_can_view_brand !== false ? "<th>Brand</th>" : ""
  const costColHeaders = schedule.client_can_view_pricing !== false
    ? "<th style='text-align:right;'>Unit ₹</th><th style='text-align:right;'>Total ₹</th>"
    : ""

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Inter, system-ui, sans-serif; color: #1a1a2e; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 32px 32px 16px; background: #1a1a2e; color: white; }
        .header-left p { font-size: 11px; opacity: 0.7; margin-top: 2px; }
        .header-right { text-align: right; }
        .header-right h2 { font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #e94560; }
        .header-right p { font-size: 11px; opacity: 0.8; margin-top: 4px; }
        .divider { height: 2px; background: #e94560; }
        .content { padding: 24px 32px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #1a1a2e; text-align: left; }
        .footer { padding: 16px 32px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 24px; }
        .grand-total { padding: 12px 32px; background: #1a1a2e; color: white; display: flex; justify-content: flex-end; gap: 24px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          ${studio?.logo_url ? `<img src="${studio.logo_url}" style="height:48px;margin-bottom:8px;" />` : ""}
          <strong style="font-size:16px;">${studio?.name ?? "Studio"}</strong>
          ${studio?.gstin ? `<p>GSTIN: ${studio.gstin}</p>` : ""}
          ${studio?.address_line1 ? `<p>${studio.address_line1}${studio.address_line2 ? ", " + studio.address_line2 : ""}</p>` : ""}
          ${studio?.postcode ? `<p>${studio.postcode}${studio.state_code ? " · State: " + studio.state_code : ""}</p>` : ""}
        </div>
        <div class="header-right">
          <h2>PROCUREMENT SCHEDULE</h2>
          <p style="font-size:14px;font-weight:600;color:white;margin-top:8px;">${schedule.name}</p>
          <p>Project: ${project?.name ?? "—"}</p>
          <p>Date: ${today} · Updated: ${updatedAt}</p>
        </div>
      </div>
      <div class="divider"></div>

      <div class="content">
        <table>
          <thead>
            <tr>
              <th style="width:48px;"></th>
              <th>Item</th>
              ${brandColHeader}
              <th style="text-align:center;">Qty</th>
              ${costColHeaders}
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${groupsHtml}
          </tbody>
        </table>
      </div>

      <div class="grand-total">
        <span style="font-size:12px;opacity:0.8;">Grand Total</span>
        <span style="font-size:16px;font-weight:700;">${formatINR(grandTotal)}</span>
      </div>

      <div class="footer">
        Generated by ProjectFlow · ${new Date().toLocaleString("en-IN")} · Confidential
      </div>
    </body>
    </html>
  `

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    })
    await browser.close()

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${schedule.name.replace(/[^a-z0-9]/gi, "_")}.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF generation failed:", err)
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 })
  }
}
