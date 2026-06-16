import type { BackendMedia } from './mediaMap'

// schema.org structured data for a book/film page, emitted as <script
// type="application/ld+json"> so search engines can show rich results.
export function mediaJsonLd(m: BackendMedia, url: string): Record<string, unknown> {
  const common: Record<string, unknown> = {
    '@context': 'https://schema.org',
    name: m.title,
    url,
  }
  if (m.description) common.description = m.description
  if (m.cover_url) common.image = m.cover_url

  if (m.type === 'book') {
    return {
      ...common,
      '@type': 'Book',
      ...(m.author ? { author: { '@type': 'Person', name: m.author } } : {}),
      ...(m.isbn ? { isbn: m.isbn } : {}),
      ...(m.pages ? { numberOfPages: m.pages } : {}),
      ...(m.year ? { datePublished: String(m.year) } : {}),
    }
  }

  return {
    ...common,
    '@type': m.type === 'series' ? 'TVSeries' : 'Movie',
    ...(m.director ? { director: { '@type': 'Person', name: m.director } } : {}),
    ...(m.year ? { datePublished: String(m.year) } : {}),
  }
}
