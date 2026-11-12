import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/sitemap'

// Everything public (home, discover, /b, /m, /p, /list, /u profiles, search) is
// crawlable; the signed-in app and the API are not. /api/og/ stays open — it
// serves the preview images that link cards and search results use.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'],
        disallow: [
          '/api/',
          '/library',
          '/lists',
          '/shelf/',
          '/search',
          '/statistics',
          '/notifications',
          '/messages',
          '/welcome',
          '/librarian',
          '/calendar',
          '/u/*/edit',
          '/u/*/library',
        ],
      },
    ],
    // The index lives at /sitemaps/index.xml (/sitemap.xml is a rewrite to it).
    sitemap: `${SITE_URL}/sitemaps/index.xml`,
    host: SITE_URL,
  }
}
