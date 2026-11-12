import { buildIndex, XML_HEADERS } from '@/lib/sitemap'

// Rendered per request, never at build time: at build the API may be down or not
// yet updated, and a prerendered index would then be frozen without the
// media/people/lists files. The CDN caching comes from XML_HEADERS instead.
export const dynamic = 'force-dynamic'

// Sitemap index (see lib/sitemap.ts).
export async function GET() {
  const xml = await buildIndex()
  if (!xml) return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return new Response(xml, { headers: XML_HEADERS })
}
