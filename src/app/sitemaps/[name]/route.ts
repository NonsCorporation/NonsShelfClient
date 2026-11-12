import { buildFile, XML_HEADERS } from '@/lib/sitemap'

// Rendered per request (see sitemap.xml/route.ts for why not at build time).
export const dynamic = 'force-dynamic'

// One sitemap file: /sitemaps/static.xml, /sitemaps/media-1.xml, … (lib/sitemap.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const r = await buildFile(name)
  if ('status' in r) return new Response(r.status === 404 ? 'Not found' : 'Temporarily unavailable', { status: r.status, headers: { 'Cache-Control': 'no-store' } })
  return new Response(r.xml, { headers: XML_HEADERS })
}
