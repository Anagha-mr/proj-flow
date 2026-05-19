import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import puppeteer from "puppeteer"
import { getPortfolioExportData } from "@/app/actions/portfolio"
import type { PortfolioExportOptions, PortfolioProject } from "@/app/actions/portfolio"

function escHtml(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function groupBySpaceTag(items: PortfolioProject["gallery_items"]) {
  const tagged: Record<string, typeof items> = {}
  const untagged: typeof items = []
  for (const item of items) {
    if (item.space_tag) {
      if (!tagged[item.space_tag]) tagged[item.space_tag] = []
      tagged[item.space_tag].push(item)
    } else {
      untagged.push(item)
    }
  }
  return { tagged, untagged }
}

function buildHtml(
  projects: PortfolioProject[],
  studio: { name: string; logo_url: string | null; gstin: string | null; contact_email: string | null; website?: string | null },
  options: PortfolioExportOptions
): string {
  const imgStyle = `width:100%;height:100%;object-fit:cover;display:block;`
  const pageW = options.page_size === "A3"
    ? (options.orientation === "landscape" ? "420mm" : "297mm")
    : (options.orientation === "landscape" ? "297mm" : "210mm")
  const pageH = options.page_size === "A3"
    ? (options.orientation === "landscape" ? "297mm" : "420mm")
    : (options.orientation === "landscape" ? "210mm" : "297mm")

  const css = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; background:#fff; color:#1a1a2e; }
    .page {
      width:${pageW}; min-height:${pageH}; page-break-after:always;
      position:relative; overflow:hidden; display:flex; flex-direction:column;
    }
    .page:last-child { page-break-after:avoid; }
    .cover { position:relative; width:${pageW}; height:${pageH}; background:#1a1a2e; }
    .cover img.hero { position:absolute; inset:0; ${imgStyle} }
    .cover .overlay {
      position:absolute; inset:0;
      background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);
    }
    .cover .logo {
      position:absolute; top:24px; left:24px; width:80px; height:80px;
      object-fit:contain; border-radius:8px; background:#fff; padding:4px;
    }
    .cover .studio-name-cover {
      position:absolute; top:28px; left:24px;
      color:#fff; font-size:22px; font-weight:bold; letter-spacing:1px;
    }
    .cover .bottom-info {
      position:absolute; bottom:0; left:0; right:0; padding:32px 40px;
      color:#fff;
    }
    .cover .bottom-info h1 { font-size:36px; font-weight:bold; margin-bottom:8px; }
    .cover .bottom-info .meta { font-size:16px; opacity:0.85; }
    .detail-page { padding:40px 48px; display:flex; flex-direction:column; gap:20px; }
    .detail-page h1 { font-size:28px; font-weight:bold; color:#1a1a2e; }
    .detail-page .meta-row { font-size:14px; color:#555; margin-top:-8px; }
    .detail-page .section-label { font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:#e94560; margin-bottom:4px; }
    .detail-page .section-body { font-size:14px; color:#333; line-height:1.6; }
    .images-page { display:flex; flex-direction:column; gap:0; width:${pageW}; height:${pageH}; }
    .image-half { flex:1; position:relative; overflow:hidden; }
    .image-half img { ${imgStyle} }
    .image-half .caption { position:absolute; bottom:0; left:0; right:0; padding:6px 12px; background:rgba(0,0,0,0.45); color:#fff; font-size:11px; font-style:italic; }
    .space-heading-page { padding:40px 48px; display:flex; align-items:center; }
    .space-heading-page h2 { font-size:22px; font-weight:bold; color:#1a1a2e; border-left:4px solid #e94560; padding-left:16px; }
    .divider-page {
      width:${pageW}; height:${pageH}; background:#1a1a2e;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px;
    }
    .divider-page .logo-div { width:100px; object-fit:contain; }
    .divider-page .next-project { color:#fff; font-size:28px; font-weight:bold; text-align:center; padding:0 40px; }
    .back-cover {
      width:${pageW}; height:${pageH}; background:#1a1a2e;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
    }
    .back-cover .logo-bc { width:120px; object-fit:contain; margin-bottom:8px; }
    .back-cover .studio-name { color:#fff; font-size:28px; font-weight:bold; }
    .back-cover .contact { color:#fff; opacity:0.75; font-size:14px; text-align:center; line-height:1.8; }
    .back-cover .gstin { color:#fff; opacity:0.5; font-size:12px; margin-top:8px; }
    @media print {
      html, body { width:${pageW}; }
      .page { page-break-after:always; }
    }
  `

  function logoHtml(cls: string) {
    if (studio.logo_url) {
      return `<img class="${cls}" src="${escHtml(studio.logo_url)}" alt="${escHtml(studio.name)}" />`
    }
    return `<div class="${cls}" style="background:#e94560;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:18px;border-radius:8px;">${escHtml(studio.name.charAt(0))}</div>`
  }

  const pages: string[] = []

  projects.forEach((project, idx) => {
    // Divider between projects
    if (idx > 0) {
      pages.push(`
        <div class="page divider-page">
          ${logoHtml("logo-div")}
          <div class="next-project">${escHtml(project.name)}</div>
        </div>
      `)
    }

    // Cover page
    const heroItem = project.gallery_items.find((i) => i.include_in_export) ?? project.gallery_items[0]
    pages.push(`
      <div class="page cover">
        ${heroItem ? `<img class="hero" src="${escHtml(heroItem.image_url)}" alt="" />` : ""}
        <div class="overlay"></div>
        ${studio.logo_url
          ? `<img class="logo" src="${escHtml(studio.logo_url)}" alt="${escHtml(studio.name)}" />`
          : `<div class="studio-name-cover">${escHtml(studio.name)}</div>`}
        <div class="bottom-info">
          <h1>${escHtml(project.name)}</h1>
          <div class="meta">
            ${options.include_project_location && project.portfolio_location_city ? escHtml(project.portfolio_location_city) + " · " : ""}${escHtml(project.type)}${project.portfolio_year_completed ? " · " + project.portfolio_year_completed : ""}
          </div>
        </div>
      </div>
    `)

    // Detail page
    const teamNames = options.include_team_members
      ? project.members.map((m) => m.user?.name).filter(Boolean).join(", ")
      : ""

    pages.push(`
      <div class="page detail-page">
        <h1>${escHtml(project.name)}</h1>
        ${(options.include_project_location && (project.portfolio_location_city || project.portfolio_year_completed))
          ? `<div class="meta-row">${escHtml(project.type)}${project.portfolio_location_city ? " · " + escHtml(project.portfolio_location_city) : ""}${project.portfolio_year_completed ? " · " + project.portfolio_year_completed : ""}</div>`
          : ""}
        ${options.include_scope_summary && project.portfolio_summary ? `
          <div>
            <div class="section-label">Project Summary</div>
            <div class="section-body">${escHtml(project.portfolio_summary)}</div>
          </div>
        ` : ""}
        ${teamNames ? `
          <div>
            <div class="section-label">Team</div>
            <div class="section-body">${escHtml(teamNames)}</div>
          </div>
        ` : ""}
        ${project.portfolio_key_decisions ? `
          <div>
            <div class="section-label">Key Design Decisions</div>
            <div class="section-body">${escHtml(project.portfolio_key_decisions)}</div>
          </div>
        ` : ""}
      </div>
    `)

    // Image pages
    const exportItems = project.gallery_items.filter((i) => i.include_in_export)
    if (exportItems.length > 0) {
      const { tagged, untagged } = groupBySpaceTag(exportItems)

      function renderImagePairs(items: typeof exportItems) {
        for (let i = 0; i < items.length; i += 2) {
          const a = items[i]
          const b = items[i + 1]
          pages.push(`
            <div class="page images-page">
              <div class="image-half">
                <img src="${escHtml(a.image_url)}" alt="${escHtml(a.caption)}" />
                ${a.caption ? `<div class="caption">${escHtml(a.caption)}</div>` : ""}
              </div>
              ${b ? `
                <div class="image-half">
                  <img src="${escHtml(b.image_url)}" alt="${escHtml(b.caption)}" />
                  ${b.caption ? `<div class="caption">${escHtml(b.caption)}</div>` : ""}
                </div>
              ` : `<div class="image-half" style="background:#f5f5f5;"></div>`}
            </div>
          `)
        }
      }

      if (Object.keys(tagged).length > 0) {
        for (const [spaceTag, items] of Object.entries(tagged)) {
          pages.push(`
            <div class="page space-heading-page">
              <h2>${escHtml(spaceTag)}</h2>
            </div>
          `)
          renderImagePairs(items)
        }
        if (untagged.length > 0) renderImagePairs(untagged)
      } else {
        renderImagePairs(exportItems)
      }
    }
  })

  // Back cover
  pages.push(`
    <div class="page back-cover">
      ${logoHtml("logo-bc")}
      <div class="studio-name">${escHtml(studio.name)}</div>
      <div class="contact">
        ${studio.contact_email ? escHtml(studio.contact_email) + "<br/>" : ""}
        ${studio.website ? escHtml(studio.website) : ""}
      </div>
      ${studio.gstin ? `<div class="gstin">GSTIN: ${escHtml(studio.gstin)}</div>` : ""}
    </div>
  `)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${pages.join("")}</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("studio_id")
      .eq("id", user.id)
      .single()
    if (!profile?.studio_id) return NextResponse.json({ error: "No studio" }, { status: 403 })

    const studioId = profile.studio_id
    const options: PortfolioExportOptions = await req.json()

    // Verify all project_ids belong to this studio
    const { data: verifiedProjects } = await supabase
      .from("projects")
      .select("id")
      .in("id", options.project_ids)
      .eq("studio_id", studioId)

    const verifiedIds = new Set((verifiedProjects ?? []).map((p) => p.id))
    for (const pid of options.project_ids) {
      if (!verifiedIds.has(pid)) return NextResponse.json({ error: "Unauthorized project" }, { status: 403 })
    }

    // Fetch studio details
    const { data: studio } = await supabase
      .from("studios")
      .select("name, logo_url, gstin, contact_email")
      .eq("id", studioId)
      .single()

    const projects = await getPortfolioExportData(options.project_ids)

    const html = buildHtml(projects, {
      name: studio?.name ?? "Studio",
      logo_url: studio?.logo_url ?? null,
      gstin: studio?.gstin ?? null,
      contact_email: studio?.contact_email ?? null,
    }, options)

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })

    const format = options.page_size === "A3" ? "A3" : "A4"
    const landscape = options.orientation === "landscape"

    const pdf = await page.pdf({ format, landscape, printBackground: true })
    await browser.close()

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `${(studio?.name ?? "Studio").replace(/\s+/g, "_")}_Portfolio_${dateStr}.pdf`

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Portfolio PDF error:", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
