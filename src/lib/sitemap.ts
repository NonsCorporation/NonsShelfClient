import 'server-only'
import { getSitemapPage, type SitemapEntry, type SitemapKind } from './serverApi'

// sitemap.xml is an index of per-kind files (a sitemap holds at most 50,000
// URLs; the API pages at 10,000):
//   /sitemap.xml            → index
//   /sitemaps/static.xml    → home, discover
//   /sitemaps/media-1.xml   → books, films, series (/b/<uuid>, /m/<uuid>)
//   /sitemaps/people-1.xml  → authors, directors, cast (/p/<uuid>)
//   /sitemaps/lists-1.xml   → curated lists (/list/<uuid>)

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://someshelf.com').replace(/\/+$/, '')

const KINDS: SitemapKind[] = ['media', 'people', 'lists']

const iso = (unix: number) => new Date(unix * 1000).toISOString()

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  // Crawlers refetch these a few times a day; let the CDN hold them for an hour.
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
}

function pathFor(kind: SitemapKind, e: SitemapEntry): string {
  if (kind === 'media') return `/${e.type === 'book' ? 'b' : 'm'}/${e.id}`
  if (kind === 'people') return `/p/${e.id}`
  return `/list/${e.id}`
}

/** /sitemap.xml: points at the static file and every page of every kind. */
export async function buildIndex(): Promise<string> {
  const now = new Date().toISOString()
  const files = ['static.xml']
  for (const kind of KINDS) {
    const first = await getSitemapPage(kind, 1)
    if (!first) continue // API down: leave this kind out of this render
    const pages = Math.max(1, Math.ceil(first.total / first.page_size))
    for (let p = 1; p <= pages; p++) files.push(`${kind}-${p}.xml`)
  }
  const items = files
    .map((f) => `  <sitemap><loc>${xmlEscape(`${SITE_URL}/sitemaps/${f}`)}</loc><lastmod>${now}</lastmod></sitemap>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`
}

function urlset(urls: { loc: string; lastmod?: string }[]): string {
  const items = urls
    .map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`
}

/** One file of the index, by name ("static.xml", "media-2.xml", …); null for an
 *  unknown name or when the API can't be reached (a 404/503 beats an empty file
 *  that would tell Google the pages are gone). */
export async function buildFile(name: string): Promise<{ xml: string } | { status: 404 | 503 }> {
  if (name === 'static.xml') {
    return { xml: urlset([{ loc: `${SITE_URL}/` }, { loc: `${SITE_URL}/discover` }]) }
  }
  const m = name.match(/^(media|people|lists)-(\d+)\.xml$/)
  if (!m) return { status: 404 }
  const kind = m[1] as SitemapKind
  const page = Number(m[2])
  if (page < 1) return { status: 404 }
  const data = await getSitemapPage(kind, page)
  if (!data) return { status: 503 }
  if (data.entries.length === 0 && page > 1) return { status: 404 }
  return {
    xml: urlset(data.entries.map((e) => ({ loc: `${SITE_URL}${pathFor(kind, e)}`, lastmod: iso(e.updated_at) }))),
  }
}
