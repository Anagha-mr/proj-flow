import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import puppeteer from "puppeteer"
import type { SpecItem } from "@/app/actions/spec"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()
  if (!profile?.studio_id) return NextResponse.json({ error: "No studio" }, { status: 403 })

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("studio_id", profile.studio_id)
    .single()
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: specRows } = await (supabase.from as any)("spec_items")
    .select("*")
    .eq("project_id", projectId)
    .eq("studio_id", profile.studio_id)
    .order("space", { ascending: true })
    .order("surface", { ascending: true })

  const items = (specRows ?? []) as SpecItem[]

  const { data: studio } = await supabase
    .from("studios")
    .select("name, logo_url, gstin")
    .eq("id", profile.studio_id)
    .single()

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  // Group by space → surface
  const bySpace: Record<string, Record<string, SpecItem[]>> = {}
  for (const item of items) {
    if (!bySpace[item.space]) bySpace[item.space] = {}
    if (!bySpace[item.space][item.surface]) bySpace[item.space][item.surface] = []
    bySpace[item.space][item.surface].push(item)
  }

  const surfaceLabel: Record<string, string> = {
    floor: "Floor", wall: "Wall", ceiling: "Ceiling", joinery: "Joinery", other: "Other",
  }

  let bodyHtml = ""
  for (const [space, surfaces] of Object.entries(bySpace)) {
    let surfaceRows = ""
    for (const [surface, surfaceItems] of Object.entries(surfaces)) {
      surfaceRows += `
        <tr><td colspan="6" style="padding:6px 8px 2px 16px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">${surfaceLabel[surface] ?? surface}</td></tr>
      `
      for (const item of surfaceItems) {
        const revCount = (item.revisions ?? []).length
        const latestRev = revCount > 0 ? item.revisions[revCount - 1]?.changed_at : null
        const latestDate = latestRev
          ? new Date(latestRev).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : null
        const revNote = revCount > 0
          ? `<div style="font-size:9px;color:#94a3b8;font-style:italic;margin-top:2px;">Revised ${revCount} time${revCount > 1 ? "s" : ""} — last: ${latestDate}</div>`
          : ""

        surfaceRows += `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 8px 8px 24px;vertical-align:top;">
              <div style="font-size:11px;font-weight:600;">${item.material_name}</div>
              ${revNote}
            </td>
            <td style="padding:8px;font-size:11px;vertical-align:top;color:#475569;">${item.finish_type ?? "—"}</td>
            <td style="padding:8px;font-size:11px;vertical-align:top;color:#475569;">${item.supplier ?? "—"}</td>
            <td style="padding:8px;font-size:11px;vertical-align:top;color:#475569;">${item.dimensions ?? "—"}</td>
            <td style="padding:8px;font-size:11px;vertical-align:top;color:#475569;">${item.location_notes ?? "—"}</td>
            <td style="padding:8px;font-size:11px;vertical-align:top;color:#475569;">${item.drawing_reference ?? "—"}</td>
          </tr>
        `
      }
    }

    bodyHtml += `
      <tr style="background:#f1f5f9;">
        <td colspan="6" style="padding:8px 8px 4px;font-size:12px;font-weight:700;color:#1a1a2e;">${space}</td>
      </tr>
      ${surfaceRows}
    `
  }

  if (!bodyHtml) {
    bodyHtml = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;font-size:12px;">No specification items found.</td></tr>`
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Inter,system-ui,sans-serif; color:#1a1a2e; font-size:12px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; padding:32px 32px 16px; background:#1a1a2e; color:white; }
        .header-left p { font-size:11px; opacity:0.7; margin-top:2px; }
        .header-right { text-align:right; }
        .header-right h2 { font-size:16px; font-weight:700; letter-spacing:1px; color:#e94560; }
        .divider { height:2px; background:#e94560; }
        .content { padding:24px 32px; }
        table { width:100%; border-collapse:collapse; }
        th { padding:8px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; border-bottom:2px solid #1a1a2e; text-align:left; }
        @page { margin:0; size:A4; }
        .footer { padding:10px 32px; text-align:center; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; position:fixed; bottom:0; width:100%; background:white; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          ${studio?.logo_url ? `<img src="${studio.logo_url}" style="height:40px;margin-bottom:6px;" />` : ""}
          <strong style="font-size:15px;">${studio?.name ?? "Studio"}</strong>
          ${studio?.gstin ? `<p>GSTIN: ${studio.gstin}</p>` : ""}
        </div>
        <div class="header-right">
          <h2>MATERIAL &amp; FINISH SPECIFICATION</h2>
          <p style="font-size:13px;font-weight:600;color:white;margin-top:6px;">${project.name}</p>
          <p style="font-size:10px;opacity:0.7;margin-top:4px;">Export date: ${today}</p>
        </div>
      </div>
      <div class="divider"></div>
      <div class="content">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Finish</th>
              <th>Supplier</th>
              <th>Dimensions</th>
              <th>Location Notes</th>
              <th>Drawing Ref</th>
            </tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </div>
      <div class="footer">
        This specification supersedes all previous versions. Issue date: ${today}.
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
      margin: { top: "0", bottom: "48px", left: "0", right: "0" },
    })
    await browser.close()

    const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_spec.pdf`
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Spec PDF generation failed:", err)
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 })
  }
}
