// Thin client over the server's unified book search (books_service): the server
// searches the local catalog first, then FantLab, OpenLibrary, and Google Books,
// and returns clean, deduped results with covers and the OpenLibrary work key.
// Editions are resolved server-side too from all three sources. All the
// source-juggling, romanization and quota handling now lives on the server.

import { authedFetch } from '../lib/api'
import type { MediaItem } from '../types'

export interface BookCandidate {
  title: string
  author: string
  year?: number
  coverUrl?: string
  isbn?: string
  workId?: string // OpenLibrary work key "/works/OL…W"
  description?: string
  source: string // local | googlebooks | openlibrary
  inCatalog?: boolean
  mediaId?: number
}

export interface EditionInput {
  title?: string
  publisher?: string
  published_year?: number
  isbn13?: string
  isbn10?: string
  pages?: number
  language?: string
  cover_url?: string
  description?: string
  source?: string
}

type ServerBook = {
  title: string
  author?: string
  year?: number
  cover_url?: string
  isbn?: string
  description?: string
  work_key?: string
  source: string
  in_catalog?: boolean
  media_id?: number
}

type ServerEdition = {
  title?: string
  language?: string
  isbn13?: string
  isbn10?: string
  publisher?: string
  published_year?: number
  pages?: number
  cover_url?: string
  description?: string
  source?: string
}

function mapBook(b: ServerBook): BookCandidate {
  return {
    title: b.title,
    author: b.author ?? '',
    year: b.year || undefined,
    coverUrl: b.cover_url || undefined,
    isbn: b.isbn || undefined,
    workId: b.work_key || undefined,
    description: b.description || undefined,
    source: b.source,
    inCatalog: b.in_catalog,
    mediaId: b.media_id,
  }
}

// Search books: local catalog first, then external sources (all server-side).
export async function searchBooks(q: string): Promise<BookCandidate[]> {
  const query = q.trim()
  if (!query) return []
  try {
    const res = await authedFetch(`/api/books/search?q=${encodeURIComponent(query)}&limit=30`)
    if (!res.ok) return []
    const data: { items?: ServerBook[] } = await res.json()
    return (data.items ?? []).map(mapBook)
  } catch {
    return []
  }
}

// Resolve a work's editions (by OL work key, or title+author when there's none).
export async function fetchWorkEditions(workId: string, title?: string, author?: string): Promise<EditionInput[]> {
  const params = new URLSearchParams()
  if (workId) params.set('work', workId)
  if (title) params.set('title', title)
  if (author) params.set('author', author)
  if (![...params].length) return []
  try {
    const res = await authedFetch(`/api/books/editions?${params.toString()}`)
    if (!res.ok) return []
    const data: { items?: ServerEdition[] } = await res.json()
    return (data.items ?? []).map((e) => ({
      title: e.title || undefined,
      publisher: e.publisher || undefined,
      published_year: e.published_year || undefined,
      isbn13: e.isbn13 || undefined,
      isbn10: e.isbn10 || undefined,
      pages: e.pages || undefined,
      language: e.language || undefined,
      cover_url: e.cover_url || undefined,
      description: e.description || undefined,
      source: e.source || undefined,
    }))
  } catch {
    return []
  }
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
    description: c.description,
  }
}

/** Human label for a candidate's source. */
export function sourceLabel(source: string): string {
  if (source === 'googlebooks') return 'Google Books'
  if (source === 'openlibrary') return 'OpenLibrary'
  if (source === 'fantlab') return 'ФантЛаб'
  return ''
}
