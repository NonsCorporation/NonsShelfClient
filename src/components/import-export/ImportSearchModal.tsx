import { useEffect, useState } from 'react'
import { IoClose, IoSearch, IoBookOutline, IoFilmOutline, IoTvOutline, IoCloudDownloadOutline, IoOpenOutline, IoBarcodeOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { librarianService } from '@/services/librarianService'
import type { TmdbCandidate } from '@/services/librarianService'
import { searchBooks, bookCandidateToItem, fetchWorkEditions, sourceLabel, lookupIsbn, isbnEditionToCandidate } from '@/services/bookSearch'
import InfinityLoader from '@/components/ui/InfinityLoader'
import BarcodeScannerModal from '@/components/import-export/BarcodeScannerModal'

type Kind = 'book' | 'movie' | 'series'

// A unified row for the results list, regardless of source.
type Row = {
  key: string
  title: string
  subtitle: string
  coverUrl?: string
  source?: string // where the candidate came from (OpenLibrary / Google Books)
  existing?: boolean // already in the local catalog
  run: () => Promise<number> // imports (or returns the existing id) and yields the catalog id
}

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Called with the new catalog id after a successful import. */
  onImported: (id: string) => void
}

// Librarian import: search OpenLibrary (books, keyless) or TMDB (movies/series,
// via the server proxy) by name/ISBN, then create a catalog row in one click.
const ISBN_LIKE = /^[0-9Xx-]{10,17}$/

export default function ImportSearchModal({ isOpen, onClose, onImported }: Props) {
  const { t } = useLanguage()
  const [kind, setKind] = useState<Kind>('book')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  // pending = debounce timer is running (user typed, not yet searching)
  const [pending, setPending] = useState(false)
  const [importingKey, setImportingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  // Set right after a barcode scan so the next search fires immediately
  // instead of waiting out the normal typing debounce.
  const [instant, setInstant] = useState(false)
  const [isbnLookup, setIsbnLookup] = useState<'idle' | 'loading' | 'not-found'>('idle')

  // Reset when reopened.
  useEffect(() => {
    if (isOpen) {
      setQ('')
      setRows([])
      setError('')
      setPending(false)
      setIsbnLookup('idle')
    }
  }, [isOpen])

  // Debounced search. Shows skeleton immediately on keystroke (pending),
  // then fires the real request after 3 s (instantly after a barcode scan).
  useEffect(() => {
    if (!isOpen) return
    setIsbnLookup('idle')
    if (!q.trim()) {
      setRows([])
      setLoading(false)
      setPending(false)
      return
    }
    setError('')
    setPending(true)
    const delay = instant ? 0 : 3000
    const timer = setTimeout(async () => {
      setInstant(false)
      setPending(false)
      setLoading(true)
      try {
        const next = kind === 'book' ? await searchBooksRows(q) : await searchTmdbRows(kind, q)
        setRows(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setRows([])
      } finally {
        setLoading(false)
      }
    }, delay)
    return () => { clearTimeout(timer); setPending(false) }
  }, [q, kind, isOpen, instant])

  if (!isOpen) return null

  const doImport = async (row: Row) => {
    setImportingKey(row.key)
    setError('')
    try {
      const id = await row.run()
      onImported(String(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImportingKey(null)
    }
  }

  const handleScanned = (isbn: string) => {
    setScannerOpen(false)
    setKind('book')
    setInstant(true)
    setQ(isbn)
  }

  // Fallback for a scanned/typed ISBN the local + external search couldn't
  // surface: hit the server's direct-ISBN lookup (Google Books + OpenLibrary).
  const tryIsbnLookup = async () => {
    setIsbnLookup('loading')
    const edition = await lookupIsbn(q)
    if (!edition) {
      setIsbnLookup('not-found')
      return
    }
    const candidate = isbnEditionToCandidate(q, edition)
    setRows([
      {
        key: `isbn-${candidate.isbn ?? q}`,
        title: candidate.title,
        subtitle: [candidate.author, candidate.year].filter(Boolean).join(' · '),
        coverUrl: candidate.coverUrl,
        source: sourceLabel(candidate.source),
        existing: false,
        run: async () => {
          const id = await librarianService.createMedia(bookCandidateToItem(candidate))
          const editions = await fetchWorkEditions('', candidate.title).catch(() => [])
          for (const ed of editions.slice(0, 80)) {
            await librarianService.addEdition(String(id), ed).catch(() => {})
          }
          return id
        },
      },
    ])
    setIsbnLookup('idle')
  }

  const tabs: { key: Kind; label: string; Icon: typeof IoBookOutline }[] = [
    { key: 'book', label: t('book'), Icon: IoBookOutline },
    { key: 'movie', label: t('movie'), Icon: IoFilmOutline },
    { key: 'series', label: t('series'), Icon: IoTvOutline },
  ]

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)]"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('importTitle')}</h3>
            <p className="mt-1 text-xs tracking-wide text-[var(--text-muted)]">{t('importSubtitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)]">
            <IoClose className="h-5 w-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="flex-shrink-0 px-5 pt-4">
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setKind(key)
                  setRows([])
                }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  kind === key ? 'border border-[var(--border-strong)] bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 px-5 pt-3">
          <div className="relative flex-1">
            <IoSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={kind === 'book' ? t('importBookPlaceholder') : t('importTmdbPlaceholder')}
              className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-10 pr-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            />
          </div>
          {kind === 'book' && (
            <button
              onClick={() => setScannerOpen(true)}
              title={t('scanBarcode')}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              <IoBarcodeOutline className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

          {/* Ghost skeletons while debounce is pending or request is in-flight */}
          {(pending || loading) && (
            <div className="flex flex-col gap-2">
              <SkeletonRows />
            </div>
          )}

          {!pending && !loading && !q.trim() && (
            <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t('searchToBegin')}</p>
          )}

          {/* No results → show the infinity loader so it feels alive */}
          {!pending && !loading && q.trim() && rows.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-6">
              <InfinityLoader hint={t('searchingMore')} />
              {kind === 'book' && ISBN_LIKE.test(q.trim()) && (
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-xs text-[var(--text-muted)]">{t('isbnNotFoundLocally')}</p>
                  <button
                    onClick={tryIsbnLookup}
                    disabled={isbnLookup === 'loading'}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    {isbnLookup === 'loading' ? t('looking') : t('lookUpIsbnDirectly')}
                  </button>
                  {isbnLookup === 'not-found' && <p className="text-xs text-red-500">{t('isbnNotFound')}</p>}
                </div>
              )}
            </div>
          )}

          {!pending && !loading && rows.length > 0 && (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                  <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                    {row.coverUrl ? <img src={row.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{row.title}</p>
                      {row.existing && (
                        <span className="flex-shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                          {t('inCatalog')}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {row.subtitle}
                      {row.source ? <span className="text-[var(--placeholder)]"> · {row.source}</span> : null}
                    </p>
                  </div>
                  <button
                    onClick={() => doImport(row)}
                    disabled={importingKey !== null}
                    className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      row.existing
                        ? 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border-subtle)]'
                        : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                    }`}
                  >
                    {row.existing ? <IoOpenOutline className="h-4 w-4" /> : <IoCloudDownloadOutline className="h-4 w-4" />}
                    {importingKey === row.key
                      ? row.existing
                        ? t('loading')
                        : t('importing')
                      : row.existing
                        ? t('openInCatalog')
                        : t('import')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BarcodeScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
    </div>
  )
}

// ── source adapters → unified rows ────────────────────────────────────────────

// ── Skeleton loading rows ─────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      <style>{`
        @keyframes sk-shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .sk {
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            var(--surface-hover) 25%,
            var(--surface-active) 50%,
            var(--surface-hover) 75%
          );
          background-size: 800px 100%;
          animation: sk-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"
          style={{ opacity: 1 - i * 0.15 }}
        >
          {/* Cover */}
          <div className="sk h-16 w-11 flex-shrink-0 rounded" />
          {/* Text lines */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="sk h-4 w-3/4 rounded" />
            <div className="sk h-3 w-1/2 rounded" />
            <div className="sk h-3 w-1/3 rounded" />
          </div>
          {/* Button */}
          <div className="sk h-8 w-16 flex-shrink-0 rounded-lg" />
        </div>
      ))}
    </>
  )
}

// ── source adapters → unified rows ────────────────────────────────────────────

async function searchBooksRows(q: string): Promise<Row[]> {
  // The server already searches the local catalog first, then external sources,
  // and flags which hits are already in the catalog (in_catalog + media_id).
  const candidates = await searchBooks(q)
  return candidates.map((c, i) => ({
    key: `book-${c.isbn ?? c.workId ?? c.title}-${i}`,
    title: c.title,
    subtitle: [c.author, c.year].filter(Boolean).join(' · '),
    coverUrl: c.coverUrl,
    source: sourceLabel(c.source),
    existing: !!c.inCatalog,
    run: async () => {
      if (c.inCatalog && c.mediaId) return c.mediaId
      const id = await librarianService.createMedia(bookCandidateToItem(c))
      // Attach the work's editions (resolved + cleaned server-side, original
      // script titles). Idempotent server-side, so re-import upgrades in place.
      const editions = await fetchWorkEditions(c.workId ?? '', c.title, c.author).catch(() => [])
      for (const ed of editions.slice(0, 80)) {
        await librarianService.addEdition(String(id), ed).catch(() => {})
      }
      return id
    },
  }))
}

async function searchTmdbRows(kind: 'movie' | 'series', q: string): Promise<Row[]> {
  const candidates: TmdbCandidate[] = await librarianService.tmdbSearch(kind, q)
  return candidates.map((c) => ({
    key: `${kind}-${c.tmdb_id}`,
    title: c.title,
    subtitle: [c.year, c.overview].filter(Boolean).join(' · '),
    coverUrl: c.poster_url,
    run: async () => (await librarianService.tmdbImport(kind, c.tmdb_id)).id,
  }))
}
