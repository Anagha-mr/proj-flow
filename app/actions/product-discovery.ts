"use server"

import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { extractTextFromHTML, extractOpenGraph } from "@/lib/utils/html-clean"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedProduct {
  name: string | null
  brand: string | null
  price: number | null
  currency: string           // default 'INR'
  dimensions: string | null  // e.g. "120cm × 80cm × 45cm"
  material_finish: string | null
  description: string | null
  image_url: string | null
  source_url: string
  confidence: 'high' | 'medium' | 'low'
  extraction_method: 'ai' | 'opengraph' | 'manual_fallback'
}

export interface URLExtractionResult {
  success: boolean
  product: ExtractedProduct | null
  error: string | null
  cached: boolean
}

// ─── URL utilities ────────────────────────────────────────────────────────────

const STRIP_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'ref', 'source', 'fbclid', 'gclid', 'affiliate_id', 'clickid',
]

function normaliseURL(url: string): string {
  const u = new URL(url)
  STRIP_PARAMS.forEach(p => u.searchParams.delete(p))
  return u.toString()
}

function hashURL(normalised: string): string {
  return createHash("sha256").update(normalised).digest("hex")
}

// ─── extractProductFromURL ────────────────────────────────────────────────────

export async function extractProductFromURL(url: string): Promise<URLExtractionResult> {
  // 1. Validate and normalise URL
  let normalised: string
  try {
    normalised = normaliseURL(url)
    if (!normalised.startsWith('http')) throw new Error('Invalid scheme')
  } catch {
    return { success: false, product: null, error: "Invalid URL", cached: false }
  }

  const hash = hashURL(normalised)
  const serviceClient = createServiceClient()

  // 2. Check cache
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cached } = await (serviceClient.from as any)("url_extraction_cache")
      .select("extracted")
      .eq("url_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (cached?.extracted) {
      return { success: true, product: cached.extracted as ExtractedProduct, cached: true, error: null }
    }
  } catch {
    // Cache miss — continue with fresh fetch
  }

  // 3. Fetch page HTML server-side (avoids CORS on client)
  let html: string
  try {
    const response = await fetch(normalised, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProjectFlow/1.0; +https://projectflow.in)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return { success: false, product: null, error: "Could not fetch page", cached: false }
    }
    html = await response.text()
  } catch {
    return { success: false, product: null, error: "Could not fetch page", cached: false }
  }

  let product: ExtractedProduct | null = null

  // 4. Try OpenGraph extraction first (fast, no AI tokens)
  const og = extractOpenGraph(html)
  const ogTitle = og['og:title'] || og['twitter:title']
  const ogPrice = og['og:price:amount'] || og['product:price:amount']

  if (ogTitle && ogPrice) {
    const price = parseFloat(ogPrice.replace(/[^0-9.]/g, ''))
    product = {
      name: ogTitle,
      brand: og['og:brand'] || og['product:brand'] || null,
      price: isNaN(price) ? null : price,
      currency: 'INR',
      dimensions: null,
      material_finish: null,
      description: og['og:description'] || og['twitter:description'] || null,
      image_url: og['og:image'] || null,
      source_url: normalised,
      confidence: 'high',
      extraction_method: 'opengraph',
    }
  }

  // 5. AI extraction via Groq (if OpenGraph insufficient)
  if (!product) {
    try {
      const cleanedHtml = extractTextFromHTML(html, 3000)

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 400,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a product data extractor for an interior design procurement tool. Extract product information from the provided webpage text and return ONLY a JSON object with these fields:
{
  "name": "product name",
  "brand": "brand name or null",
  "price": number or null (in INR, no currency symbol),
  "dimensions": "L×W×H in cm or null",
  "material_finish": "material and/or finish description or null",
  "description": "brief product description under 100 words or null",
  "image_url": "main product image URL or null",
  "confidence": "high|medium|low"
}
Return null for any field you cannot determine. For price, return only the number. For Indian products, prices are in INR.`,
            },
            {
              role: 'user',
              content: `Extract product data from this webpage:\nURL: ${normalised}\n\n${cleanedHtml}`,
            },
          ],
        }),
      })

      if (!groqRes.ok) {
        return { success: false, product: null, error: "Could not extract product details. Please fill in manually.", cached: false }
      }

      const aiData = await groqRes.json()
      const extracted = JSON.parse(aiData.choices[0].message.content)

      product = {
        name: extracted.name ?? null,
        brand: extracted.brand ?? null,
        price: typeof extracted.price === 'number' ? extracted.price : null,
        currency: 'INR',
        dimensions: extracted.dimensions ?? null,
        material_finish: extracted.material_finish ?? null,
        description: extracted.description ?? null,
        image_url: extracted.image_url ?? null,
        source_url: normalised,
        confidence: (['high', 'medium', 'low'].includes(extracted.confidence) ? extracted.confidence : 'medium') as 'high' | 'medium' | 'low',
        extraction_method: 'ai',
      }
    } catch {
      return { success: false, product: null, error: "Could not extract product details. Please fill in manually.", cached: false }
    }
  }

  if (!product) {
    return { success: false, product: null, error: "Could not extract product details. Please fill in manually.", cached: false }
  }

  // 6. Store in cache (non-fatal if fails)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient.from as any)("url_extraction_cache").upsert({
      url_hash: hash,
      source_url: normalised,
      extracted: product,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'url_hash' })
  } catch {
    // Cache write failure is non-fatal
  }

  return { success: true, product, cached: false, error: null }
}

// ─── refreshProductFromURL ────────────────────────────────────────────────────

export async function refreshProductFromURL(procurementItemId: string): Promise<URLExtractionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id")
    .eq("id", user.id)
    .single()
  if (!profile?.studio_id) throw new Error("No studio found")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from("procurement_items") as any)
    .select("source_url, project_id")
    .eq("id", procurementItemId)
    .eq("studio_id", profile.studio_id)
    .single() as { data: { source_url: string | null; project_id: string } | null }

  if (!item) throw new Error("Item not found")
  if (!item.source_url) throw new Error("No source URL stored for this item")

  // Delete existing cache entry to force a fresh fetch
  const serviceClient = createServiceClient()
  const hash = hashURL(normaliseURL(item.source_url))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient.from as any)("url_extraction_cache").delete().eq("url_hash", hash)

  // Re-extract (cache was just cleared, so will fetch fresh)
  const result = await extractProductFromURL(item.source_url)

  if (result.success && result.product) {
    const p = result.product
    const updates: Record<string, unknown> = {
      last_url_refresh_at: new Date().toISOString(),
    }
    if (p.name) updates.name = p.name
    if (p.brand) updates.brand = p.brand
    if (p.price !== null && p.price !== undefined) updates.unit_cost = p.price
    if (p.image_url) updates.product_image_url = p.image_url
    if (p.material_finish) updates.material_finish = p.material_finish
    if (p.dimensions) updates.dimensions = p.dimensions
    if (p.description) updates.description = p.description

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("procurement_items") as any)
      .update(updates)
      .eq("id", procurementItemId)
      .eq("studio_id", profile.studio_id)

    revalidatePath(`/dashboard/projects/${item.project_id}/procurement`)
  }

  return result
}

// ─── saveExtractedProduct ─────────────────────────────────────────────────────

export async function saveExtractedProduct(input: {
  scheduleId: string
  projectId: string
  extracted: ExtractedProduct
  overrides?: Partial<ExtractedProduct>
}): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("users")
    .select("studio_id, id")
    .eq("id", user.id)
    .single()
  if (!profile?.studio_id) throw new Error("No studio found")

  // Verify schedule belongs to auth studio
  const { data: schedule } = await supabase
    .from("procurement_schedules")
    .select("id")
    .eq("id", input.scheduleId)
    .eq("studio_id", profile.studio_id)
    .single()
  if (!schedule) throw new Error("Schedule not found")

  const merged = { ...input.extracted, ...input.overrides }

  // Get max position for ordering
  const { data: maxRow } = await supabase
    .from("procurement_items")
    .select("position")
    .eq("schedule_id", input.scheduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextPosition = maxRow ? (maxRow as any).position + 1 : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase.from("procurement_items") as any)
    .insert({
      schedule_id: input.scheduleId,
      project_id: input.projectId,
      studio_id: profile.studio_id,
      name: merged.name ?? "New Item",
      unit_cost: merged.price ?? 0,
      quantity: 1,
      brand: merged.brand ?? null,
      description: merged.description ?? null,
      source_url: merged.source_url ?? null,
      product_image_url: merged.image_url ?? null,
      material_finish: merged.material_finish ?? null,
      dimensions: merged.dimensions ?? null,
      last_url_refresh_at: new Date().toISOString(),
      position: nextPosition,
      created_by_id: profile.id,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Insert matching status row
  await supabase.from("procurement_item_status").insert({
    item_id: item.id,
    studio_id: profile.studio_id,
  })

  revalidatePath(`/dashboard/projects/${input.projectId}/procurement`)
}
