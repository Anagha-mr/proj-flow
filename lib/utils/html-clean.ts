/**
 * Strip HTML tags and extract clean readable text for AI processing.
 * Removes: script, style, nav, footer, header, aside, form, button elements.
 * Collapses whitespace. Truncates to maxChars.
 */
export function extractTextFromHTML(html: string, maxChars = 3000): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return stripped.slice(0, maxChars)
}

/**
 * Extract OpenGraph and product meta tags from HTML.
 */
export function extractOpenGraph(html: string): Record<string, string> {
  const og: Record<string, string> = {}

  // Match: property/name before content
  const metaRegex = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi
  // Match: content before property/name
  const metaRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']([^"']+)["'][^>]*>/gi

  let match
  while ((match = metaRegex.exec(html)) !== null) {
    og[match[1]] = match[2]
  }
  while ((match = metaRegex2.exec(html)) !== null) {
    og[match[2]] = match[1]
  }

  return og
}
