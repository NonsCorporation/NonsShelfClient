import { buildIndex, XML_HEADERS } from '@/lib/sitemap'

// Sitemap index (see lib/sitemap.ts).
export async function GET() {
  return new Response(await buildIndex(), { headers: XML_HEADERS })
}
