import { buildFile, XML_HEADERS } from '@/lib/sitemap'

// One sitemap file: /sitemaps/static.xml, /sitemaps/media-1.xml, … (lib/sitemap.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const r = await buildFile(name)
  if ('status' in r) return new Response('Not found', { status: r.status })
  return new Response(r.xml, { headers: XML_HEADERS })
}
