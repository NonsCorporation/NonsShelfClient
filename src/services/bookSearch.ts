// Client-side book search. Books don't need an API key, so (unlike TMDB) the
// lookup runs straight from the browser — and we query BOTH OpenLibrary and
// Google Books, then merge + dedupe, for the widest coverage (Google Books is
// strong on recent/Russian titles, OpenLibrary on older works + editions).
// Returns candidates a librarian can import into the catalog as a book row.

import type { MediaItem } from '../types'

export interface BookCandidate {
  title: string
  author: string
  year?: number
  coverUrl?: string
  isbn?: string
  workId?: string // OpenLibrary work key, e.g. "/works/OL…W"
  pages?: number
  description?: string
  source: 'openlibrary' | 'googlebooks'
}

const isIsbn = (q: string) => /^[0-9Xx-]{10,17}$/.test(q.trim()) && /\d/.test(q)

// ── OpenLibrary ───────────────────────────────────────────────────────────────

type OLDoc = {
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
  key?: string
  number_of_pages_median?: number
}

const OL_COVER = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`

async function searchOpenLibrary(q: string): Promise<BookCandidate[]> {
  const param = isIsbn(q) ? `isbn=${encodeURIComponent(q.replace(/[^0-9Xx]/g, ''))}` : `q=${encodeURIComponent(q)}`
  const fields = 'title,author_name,first_publish_year,cover_i,isbn,key,number_of_pages_median'
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${param}&fields=${fields}&limit=12`)
    if (!res.ok) return []
    const data: { docs?: OLDoc[] } = await res.json()
    return (data.docs ?? []).map((d) => ({
      title: d.title ?? '',
      author: d.author_name?.[0] ?? '',
      year: d.first_publish_year || undefined,
      coverUrl: d.cover_i ? OL_COVER(d.cover_i) : undefined,
      isbn: d.isbn?.find((x) => x.length === 13) || d.isbn?.[0] || undefined,
      workId: d.key || undefined,
      pages: d.number_of_pages_median || undefined,
      source: 'openlibrary' as const,
    }))
  } catch {
    return []
  }
}

// ── Google Books ──────────────────────────────────────────────────────────────

type GBVolume = {
  volumeInfo?: {
    title?: string
    authors?: string[]
    publishedDate?: string
    pageCount?: number
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type?: string; identifier?: string }[]
  }
}

// Same keyless quota as the ISBN autofill; an optional key lifts the limit.
const GBOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined
const year4 = (s?: string) => (s || '').match(/\d{4}/)?.[0]

async function searchGoogleBooks(q: string): Promise<BookCandidate[]> {
  const query = isIsbn(q) ? `isbn:${q.replace(/[^0-9Xx]/g, '')}` : q
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12` +
    (GBOOKS_KEY ? `&key=${GBOOKS_KEY}` : '')
  try {
    const res = await fetch(url)
    if (!res.ok) return [] // 429 (quota) or other — OpenLibrary still covers us
    const data: { items?: GBVolume[] } = await res.json()
    return (data.items ?? []).flatMap((it) => {
      const v = it.volumeInfo
      if (!v?.title) return []
      const ids = v.industryIdentifiers ?? []
      const isbn =
        ids.find((i) => i.type === 'ISBN_13')?.identifier ||
        ids.find((i) => i.type === 'ISBN_10')?.identifier ||
        undefined
      return [
        {
          title: v.title,
          author: v.authors?.[0] ?? '',
          year: v.publishedDate ? Number(year4(v.publishedDate)) || undefined : undefined,
          coverUrl: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace(/^http:/, 'https:') || undefined,
          isbn,
          pages: v.pageCount || undefined,
          description: v.description || undefined,
          source: 'googlebooks' as const,
        },
      ]
    })
  } catch {
    return []
  }
}

// ── merge ─────────────────────────────────────────────────────────────────────

/** Identity key for dedupe: ISBN-13 if present, else title+author. */
export function bookKey(b: { isbn?: string; title: string; author?: string }): string {
  if (b.isbn) return `isbn:${b.isbn.replace(/[^0-9Xx]/g, '')}`
  return `t:${b.title.trim().toLowerCase()}|${(b.author ?? '').trim().toLowerCase()}`
}

// Search both sources in parallel and merge. OpenLibrary entries win on a tie
// (they carry the work id used for catalog identity), but a Google Books-only
// match still surfaces. Capped to keep the list scannable.
export async function searchBooks(q: string): Promise<BookCandidate[]> {
  const query = q.trim()
  if (!query) return []
  const [ol, gb] = await Promise.all([searchOpenLibrary(query), searchGoogleBooks(query)])

  const merged = new Map<string, BookCandidate>()
  for (const c of [...ol, ...gb]) {
    if (!c.title) continue
    const key = bookKey(c)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, c)
    } else {
      // Fill gaps from the other source (e.g. GB cover/description onto an OL row).
      merged.set(key, {
        ...existing,
        coverUrl: existing.coverUrl || c.coverUrl,
        description: existing.description || c.description,
        pages: existing.pages || c.pages,
        isbn: existing.isbn || c.isbn,
        year: existing.year || c.year,
        author: existing.author || c.author,
      })
    }
  }
  return [...merged.values()].slice(0, 20)
}

// Shape a candidate as the MediaItem the catalog create form expects.
export function bookCandidateToItem(c: BookCandidate): Partial<MediaItem> {
  return {
    type: 'book',
    title: c.title,
    author: c.author,
    year: c.year,
    coverUrl: c.coverUrl,
    isbn: c.isbn,
    workId: c.workId,
    pages: c.pages,
    description: c.description,
  }
}
