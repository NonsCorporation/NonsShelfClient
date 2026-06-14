import { useState, useEffect } from 'react'
import { IoClose, IoBookOutline, IoFilmOutline, IoTvOutline, IoSparklesOutline } from 'react-icons/io5'
import type { MediaItem, MediaType, ShelfStatus } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'
import { STATUS_ORDER, STATUS_COLOR, statusLabel } from '../lib/shelf'

// Normalized ISBN lookup result, from whichever source had the book.
type IsbnResult = {
  title?: string
  author?: string
  coverUrl?: string
  pages?: string
  year?: string
  genre?: string
  description?: string
}

const year4 = (s?: string) => (s || '').match(/\d{4}/)?.[0]

// Google Books — best coverage, especially Russian. Keyless (per-user daily
// quota). CORS-enabled.
interface GBVolumeInfo {
  title?: string
  authors?: string[]
  publishedDate?: string
  pageCount?: number
  categories?: string[]
  description?: string
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
}
function mapGB(v: GBVolumeInfo): IsbnResult {
  const cover = (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace(/^http:/, 'https:')
  return {
    title: v.title,
    author: v.authors?.[0],
    coverUrl: cover || undefined,
    pages: v.pageCount ? String(v.pageCount) : undefined,
    year: year4(v.publishedDate),
    genre: v.categories?.slice(0, 3).join(', '),
    description: v.description,
  }
}

// Optional Google Books API key (Vite env). Without it, requests use a shared
// anonymous quota that's usually exhausted (429); with it you get your own
// 1,000/day. Baked into the bundle — restrict it by HTTP referrer in Google Cloud.
const GBOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined

// One Google Books query. rateLimited=true means a 429 (quota), which is a
// "try later / add a key", not "book doesn't exist".
async function googleBooksQuery(q: string): Promise<{ rateLimited: boolean; result: IsbnResult | null }> {
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1` +
    (GBOOKS_KEY ? `&key=${GBOOKS_KEY}` : '')
  const res = await fetch(url)
  if (res.status === 429) return { rateLimited: true, result: null }
  if (!res.ok) return { rateLimited: false, result: null }
  const data: { items?: { volumeInfo?: GBVolumeInfo }[] } = await res.json()
  const v = data.items?.[0]?.volumeInfo
  return { rateLimited: false, result: v ? mapGB(v) : null }
}

// OpenLibrary — fallback. /api/books?jscmd=data
interface OLBookData {
  title?: string
  authors?: { name?: string }[]
  number_of_pages?: number
  publish_date?: string
  cover?: { small?: string; medium?: string; large?: string }
  subjects?: { name?: string }[]
}
async function lookupOpenLibraryIsbn(isbn: string): Promise<IsbnResult | null> {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
  if (!res.ok) return null
  const data: Record<string, OLBookData> = await res.json()
  const b = data[`ISBN:${isbn}`]
  if (!b) return null
  return {
    title: b.title,
    author: b.authors?.[0]?.name,
    coverUrl: b.cover?.large || b.cover?.medium,
    pages: b.number_of_pages ? String(b.number_of_pages) : undefined,
    year: year4(b.publish_date),
    genre: b.subjects?.slice(0, 3).map((x) => x.name).filter(Boolean).join(', '),
  }
}

type MediaModalProps = {
  isOpen: boolean
  initialData?: Partial<MediaItem> & { id?: string }
  initialType?: 'book' | 'movie'
  // catalogOnly hides the shelf-status control: the librarian is curating the
  // shared catalog, not adding the item to their own shelf.
  catalogOnly?: boolean
  onClose: () => void
  onSave: (data: Partial<MediaItem>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function MediaModal({ isOpen, initialData, initialType, catalogOnly, onClose, onSave, onDelete }: MediaModalProps) {
  const { t } = useLanguage()
  
  // Decide if we are editing or creating
  const isEditing = !!initialData?.id
  // Series rows aren't created from this form (they're seeded), but an existing
  // one can be edited here — so the state holds the full MediaType and anything
  // non-book uses the film-style fields.
  const [type, setType] = useState<MediaType>(initialData?.type || initialType || 'book')
  const [status, setStatus] = useState<ShelfStatus>(initialData?.status || 'wishlist')

  const [form, setForm] = useState({
    title: '',
    author: '',
    director: '',
    coverUrl: '',
    year: '',
    duration: '',
    description: '',
    pages: '',
    genre: '',
    tags: '',
    actors: '',
    isbn: ''
  })
  const [isbnBusy, setIsbnBusy] = useState(false)
  const [isbnError, setIsbnError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setType(initialData?.type || initialType || 'book')
      setStatus(initialData?.status || 'wishlist')

      const genre = Array.isArray(initialData?.genre) ? initialData.genre.join(', ') : initialData?.genre || ''
      const tags = Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : initialData?.tags || ''
      const actors = Array.isArray(initialData?.actors) ? initialData.actors.join(', ') : initialData?.actors || ''

      setForm({
        title: initialData?.title || '',
        author: initialData?.author || '',
        director: initialData?.director || '',
        coverUrl: initialData?.coverUrl || '',
        year: initialData?.year?.toString() || '',
        duration: initialData?.duration || '',
        description: initialData?.description || '',
        pages: initialData?.pages?.toString() || '',
        genre,
        tags,
        actors,
        isbn: initialData?.isbn || ''
      })
      setIsbnError(null)
    }
  }, [isOpen, initialData, initialType])

  if (!isOpen) return null

  // Look the ISBN up (Google Books first for coverage, then OpenLibrary) and
  // autofill the form fields.
  const autofillFromIsbn = async () => {
    const isbn = form.isbn.replace(/[^0-9Xx]/g, '')
    if (!isbn) return
    setIsbnBusy(true)
    setIsbnError(null)
    try {
      let found: IsbnResult | null = null
      let rateLimited = false
      // Google Books: structured isbn: query, then a plain query as fallback.
      for (const q of [`isbn:${isbn}`, isbn]) {
        const r = await googleBooksQuery(q).catch(() => ({ rateLimited: false, result: null }))
        if (r.rateLimited) rateLimited = true
        if (r.result) { found = r.result; break }
      }
      // OpenLibrary fallback.
      if (!found) found = await lookupOpenLibraryIsbn(isbn).catch(() => null)

      if (!found) {
        setIsbnError(
          rateLimited
            ? (t('isbnRateLimited') || 'Google Books is rate-limited right now — wait a minute and retry, or fill it in manually.')
            : (t('isbnNotFound') || 'No book found for that ISBN — some Russian editions aren’t in free databases. Fill it in manually.'),
        )
        return
      }
      setForm((s) => ({
        ...s,
        title: found.title || s.title,
        author: found.author || s.author,
        coverUrl: found.coverUrl || s.coverUrl,
        pages: found.pages || s.pages,
        year: found.year || s.year,
        genre: found.genre || s.genre,
        description: found.description || s.description,
      }))
    } catch {
      setIsbnError(t('isbnLookupFailed') || 'Lookup failed — check your connection.')
    } finally {
      setIsbnBusy(false)
    }
  }

  const handleSave = async () => {
    if (!form.title) return

    const baseData: Partial<MediaItem> = {
      type,
      status,
      title: form.title,
      author: form.author,
      coverUrl: form.coverUrl || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      description: form.description || undefined,
      genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : undefined,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    }

    if (type !== 'book') {
      baseData.director = form.director || form.author
      baseData.duration = form.duration || undefined
      baseData.actors = form.actors ? form.actors.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined
    } else {
      baseData.pages = form.pages ? parseInt(form.pages) : undefined
      baseData.isbn = form.isbn.replace(/[^0-9Xx]/g, '') || undefined
    }

    await onSave(baseData)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-[var(--overlay)] flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--container)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)] flex-shrink-0 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">
              {isEditing ? t('editDetails') : t('addNewEntry')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 tracking-wide">
              {isEditing ? t('updateInfo', { type: (type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')).toLowerCase() }) : t('chooseTypeDesc')}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-colors">
            <IoClose className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {!isEditing && (
          <div className="px-5 pt-4 flex-shrink-0">
            <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
              <button
                onClick={() => setType('book')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'book' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoBookOutline className="w-4 h-4" />
                {t('book')}
              </button>
              <button
                onClick={() => setType('movie')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'movie' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoFilmOutline className="w-4 h-4" />
                {t('movie')}
              </button>
              <button
                onClick={() => setType('series')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'series' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoTvOutline className="w-4 h-4" />
                {t('series')}
              </button>
            </div>
          </div>
        )}

        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          {!catalogOnly && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--text)]">{t('status')}</span>
              <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      status === s ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                    {statusLabel(type, s, t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'book' && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              ISBN
              <div className="flex gap-2">
                <input
                  className="h-11 flex-1 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow"
                  placeholder="978…"
                  value={form.isbn}
                  onChange={(e) => setForm(s => ({...s, isbn: e.target.value}))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); autofillFromIsbn() } }}
                />
                <button
                  type="button"
                  onClick={autofillFromIsbn}
                  disabled={!form.isbn || isbnBusy}
                  className="h-11 px-4 rounded-lg bg-nonsprimary text-white text-sm font-medium hover:bg-nonsprimaryfocus disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <IoSparklesOutline className="w-4 h-4" />
                  {isbnBusy ? (t('looking') || 'Looking…') : (t('autofill') || 'Autofill')}
                </button>
              </div>
              {isbnError && <span className="text-xs font-normal text-nonslightred">{isbnError}</span>}
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('title')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('title')} value={form.title} onChange={(e) => setForm(s => ({...s, title: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {type === 'book' ? t('author') : t('director')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={type === 'book' ? t('author') : t('director')} value={type === 'book' ? form.author : form.director} onChange={(e) => setForm(s => type === 'book' ? ({...s, author: e.target.value}) : ({...s, director: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('coverUrl')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('coverUrl')} value={form.coverUrl} onChange={(e) => setForm(s => ({...s, coverUrl: e.target.value}))} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('year')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('year')} value={form.year} onChange={(e) => setForm(s => ({...s, year: e.target.value}))} />
            </label>

            {type === 'book' ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
                {t('pages')}
                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('pages')} value={form.pages} onChange={(e) => setForm(s => ({...s, pages: e.target.value}))} />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
                {t('duration')}
                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('durationPlaceholder')} value={form.duration} onChange={(e) => setForm(s => ({...s, duration: e.target.value}))} />
              </label>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('genrePlaceholder')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('genrePlaceholder')} value={form.genre} onChange={(e) => setForm(s => ({...s, genre: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('tagsPlaceholder')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('tagsPlaceholder')} value={form.tags} onChange={(e) => setForm(s => ({...s, tags: e.target.value}))} />
          </label>

          {type !== 'book' && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('actorsPlaceholder')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('actorsPlaceholder')} value={form.actors} onChange={(e) => setForm(s => ({...s, actors: e.target.value}))} />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('synopsis')}
            <textarea rows={4} className="p-3 resize-none rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('synopsis')} value={form.description} onChange={(e) => setForm(s => ({...s, description: e.target.value}))} />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)] flex justify-end gap-3 flex-shrink-0">
          {isEditing && onDelete && (
            <button onClick={() => initialData.id && onDelete(initialData.id)} className="px-4 h-10 rounded-lg bg-red-500/10 text-red-500 font-medium hover:bg-red-500/20 transition-colors mr-auto">
              {t('delete')}
            </button>
          )}
          <button onClick={onClose} className="px-4 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors">
            {t('cancel')}
          </button>
          <button onClick={handleSave} className="px-6 h-10 rounded-lg bg-nonsprimary text-white font-medium hover:bg-nonsprimaryfocus transition-colors">
            {isEditing ? t('save') : `${t('add')} ${type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
