import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shelf.nonsapp.com'

// The server-rendered catalog pages — /b, /m, /p, /list, /search — are the
// crawlable surface. Everything in the (app) group sits behind the SSO gate
// and renders only a sign-in skeleton for a bot, so keep it out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/b/', '/m/', '/p/', '/list/', '/search'],
        disallow: [
          '/api/',
          '/library',
          '/u/',
          '/calendar',
          '/notifications',
          '/statistics',
          '/librarians',
          '/librarian/',
          '/shelf/',
          '/series/',
          '/franchise/',
          '/challenge/',
        ],
      },
    ],
    host: SITE,
  }
}
