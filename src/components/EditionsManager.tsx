import { useEffect, useState, useCallback } from 'react'
import { IoTrashOutline, IoCreateOutline, IoAdd, IoCheckmark, IoClose, IoLanguageOutline, IoCloudDownloadOutline, IoSparklesOutline, IoSwapHorizontalOutline, IoSearch } from 'react-icons/io5'
import { authedFetch } from '../lib/api'
import { librarianService } from '../services/librarianService'
import type { Edition } from '../services/librarianService'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { useLanguage } from '../contexts/LanguageContext'

// True when the text contains any Cyrillic letter (already "rusified").
const hasCyrillic = (s?: string) => !!s && /[Ѐ-ӿ]/.test(s)

const LANG_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'EN — English' },
  { code: 'ru', label: 'RU — Russian' },
  { code: 'de', label: 'DE — German' },
  { code: 'fr', label: 'FR — French' },
  { code: 'es', label: 'ES — Spanish' },
  { code: 'it', label: 'IT — Italian' },
  { code: 'pt', label: 'PT — Portuguese' },
  { code: 'pl', label: 'PL — Polish' },
  { code: 'uk', label: 'UK — Ukrainian' },
  { code: 'ro', label: 'RO — Romanian' },
  { code: 'nl', label: 'NL — Dutch' },
  { code: 'sv', label: 'SV — Swedish' },
  { code: 'cs', label: 'CS — Czech' },
  { code: 'hu', label: 'HU — Hungarian' },
  { code: 'tr', label: 'TR — Turkish' },
  { code: 'ja', label: 'JA — Japanese' },
  { code: 'zh', label: 'ZH — Chinese' },
  { code: 'ko', label: 'KO — Korean' },
  { code: 'ar', label: 'AR — Arabic' },
  { code: 'he', label: 'HE — Hebrew' },
  { code: 'la', label: 'LA — Latin' },
]

// Normalize ISO 639-2/B 3-letter codes to 2-letter so existing DB values
// still match a dropdown option (backend also normalizes on save).
const LANG_3TO2: Record<string, string> = {
  eng: 'en', rus: 'ru', ger: 'de', fre: 'fr', fra: 'fr', spa: 'es',
  ita: 'it', por: 'pt', pol: 'pl', ukr: 'uk', rum: 'ro', ron: 'ro',
  nld: 'nl', dut: 'nl', swe: 'sv', ces: 'cs', cze: 'cs', hun: 'hu',
  tur: 'tr', jpn: 'ja', chi: 'zh', zho: 'zh', kor: 'ko', ara: 'ar',
  heb: 'he', lat: 'la',
}
const normEditionLang = (s: string) => {
  const lc = (s ?? '').trim().toLowerCase()
  return LANG_3TO2[lc] ?? lc
}

type EditionForm = {
  title: string
  publisher: string
  language: string
  published_year: string
  pages: string
  isbn13: string
  cover_url: string
  description: string
}

const empty: EditionForm = { title: '', publisher: '', language: '', published_year: '', pages: '', isbn13: '', cover_url: '', description: '' }

function toForm(e: Edition): EditionForm {
  return {
    title: e.title ?? '',
    publisher: e.publisher ?? '',
    language: normEditionLang(e.language ?? ''),
    published_year: e.published_year ? String(e.published_year) : '',
    pages: e.pages ? String(e.pages) : '',
    isbn13: e.isbn13 ?? e.isbn10 ?? '',
    cover_url: e.cover_url ?? '',
    description: e.description ?? '',
  }
}

function fromForm(f: EditionForm): Partial<Edition> {
  const isbn = f.isbn13.replace(/[^0-9Xx]/g, '')
  return {
    title: f.title || undefined,
    publisher: f.publisher || undefined,
    language: f.language || undefined,
    published_year: f.published_year ? parseInt(f.published_year, 10) : undefined,
    pages: f.pages ? parseInt(f.pages, 10) : undefined,
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    cover_url: f.cover_url || undefined,
    description: f.description.trim() || undefined,
  }
}

// Full editions CRUD for a book work: list, add, inline edit, delete, rusify.
// Reused by the media edit modal and the librarian edit page.
export default function EditionsManager({ mediaId, fallbackTitle, fallbackAuthor }: { mediaId: string; fallbackTitle?: string; fallbackAuthor?: string }) {
  const { t } = useLanguage()
  const [editions, setEditions] = useState<Edition[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    authedFetch(`/api/media/${mediaId}/editions`)
      .then((r) => (r.ok ? r.json() : { editions: [] }))
      .then((d) => setEditions(d?.editions ?? []))
      .catch(() => setEditions([]))
      .finally(() => setLoading(false))
  }, [mediaId])

  useEffect(() => {
    reload()
  }, [reload])

  const wrap = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleAdd = (f: EditionForm) =>
    wrap(async () => {
      await librarianService.addEdition(mediaId, fromForm(f))
      setAdding(false)
      reload()
    })

  const handleUpdate = (id: number, f: EditionForm) =>
    wrap(async () => {
      await librarianService.updateEdition(mediaId, id, fromForm(f))
      setEditingId(null)
      reload()
    })

  const handleDelete = (id: number) =>
    wrap(async () => {
      await librarianService.deleteEdition(mediaId, id)
      setEditions((eds) => eds.filter((e) => e.id !== id))
    })

  const handleMove = (id: number, targetMediaId: number) =>
    wrap(async () => {
      await librarianService.moveEdition(mediaId, id, targetMediaId)
      setMovingId(null)
      // The edition now belongs to another work, so drop it from this list.
      setEditions((eds) => eds.filter((e) => e.id !== id))
    })

  const handleRusify = (id: number) =>
    wrap(async () => {
      const updated = await librarianService.rusifyEdition(id)
      setEditions((eds) => eds.map((e) => (e.id === id ? { ...e, title: updated.title } : e)))
    })

  const handleRusifyAll = () =>
    wrap(async () => {
      for (const e of editions.filter((x) => !hasCyrillic(x.title))) {
        const updated = await librarianService.rusifyEdition(e.id)
        setEditions((eds) => eds.map((x) => (x.id === e.id ? { ...x, title: updated.title } : x)))
      }
    })

  if (loading) return <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {editions.length} {(t('editions') || 'Editions').toLowerCase()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearching((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              searching
                ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-nonsprimary hover:text-nonsprimary'
            }`}
          >
            <IoSearch className="h-3.5 w-3.5" />
            {t('autoFindEditions')}
          </button>
          {editions.some((e) => !hasCyrillic(e.title)) && (
            <button
              onClick={handleRusifyAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
            >
              <IoLanguageOutline className="h-3.5 w-3.5 text-nonsprimary" />
              {t('rusifyAll')}
            </button>
          )}
        </div>
      </div>

      {searching && (
        <EditionSearchPanel
          mediaId={mediaId}
          initialTitle={fallbackTitle ?? ''}
          initialAuthor={fallbackAuthor ?? ''}
          onDone={() => { setSearching(false); reload() }}
          onClose={() => setSearching(false)}
        />
      )}

      {editions.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t('noEditionsYet')}</p>}

      <div className="flex flex-col gap-2">
        {editions.map((e) =>
          editingId === e.id ? (
            <EditionRowForm
              key={e.id}
              initial={toForm(e)}
              submitLabel={t('save')}
              onSubmit={(f) => handleUpdate(e.id, f)}
              onCancel={() => setEditingId(null)}
            />
          ) : movingId === e.id ? (
            <MoveEditionPicker
              key={e.id}
              currentMediaId={mediaId}
              editionTitle={e.title || fallbackTitle}
              onMove={(targetId) => handleMove(e.id, targetId)}
              onCancel={() => setMovingId(null)}
            />
          ) : (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
              <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                {e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate text-[var(--text)]">{e.title || fallbackTitle}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {[
                    e.publisher,
                    e.published_year || undefined,
                    (e.language || '').toUpperCase() || undefined,
                    e.pages ? t('pagesCount', { count: e.pages }) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {(e.isbn13 || e.isbn10) && <p className="text-xs text-[var(--text-muted)]">ISBN {e.isbn13 || e.isbn10}</p>}
              </div>
              {!hasCyrillic(e.title) && (
                <button onClick={() => handleRusify(e.id)} title={t('rusify')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-nonsprimary">
                  <IoLanguageOutline className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setMovingId(e.id)} title={t('moveEditionTitle')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                <IoSwapHorizontalOutline className="h-4 w-4" />
              </button>
              <button onClick={() => setEditingId(e.id)} title={t('edit')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                <IoCreateOutline className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(e.id)} title={t('delete')} className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500">
                <IoTrashOutline className="h-4 w-4" />
              </button>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <EditionRowForm initial={empty} submitLabel={t('addEdition')} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border-subtle)]"
        >
          <IoAdd className="h-4 w-4" />
          {t('addEdition')}
        </button>
      )}
    </div>
  )
}

// Inline add/edit form for one edition.
function EditionRowForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: EditionForm
  submitLabel: string
  onSubmit: (f: EditionForm) => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState(false)
  const input =
    'h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit(form)
    } finally {
      setBusy(false)
    }
  }

  // Look the ISBN up server-side (Google Books + OpenLibrary) and fill the form.
  const autofill = async () => {
    const isbn = form.isbn13.replace(/[^0-9Xx]/g, '')
    if (!isbn) return
    setFinding(true)
    try {
      const ed = await librarianService.lookupEdition(isbn)
      if (ed) {
        setForm((s) => ({
          ...s,
          title: ed.title || s.title,
          publisher: ed.publisher || s.publisher,
          language: ed.language || s.language,
          published_year: ed.published_year ? String(ed.published_year) : s.published_year,
          pages: ed.pages ? String(ed.pages) : s.pages,
          isbn13: ed.isbn13 || ed.isbn10 || s.isbn13,
          cover_url: ed.cover_url || s.cover_url,
        }))
      }
    } finally {
      setFinding(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
      <input className={input} placeholder={t('editionTitle')} value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
      <div className="flex gap-2">
        <input
          className={`${input} flex-1`}
          placeholder="ISBN"
          value={form.isbn13}
          onChange={(e) => setForm((s) => ({ ...s, isbn13: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              autofill()
            }
          }}
        />
        <button
          type="button"
          onClick={autofill}
          disabled={!form.isbn13 || finding}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
        >
          <IoSparklesOutline className="h-4 w-4" />
          {finding ? t('looking') : t('autofill')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={input} placeholder={t('publisher')} value={form.publisher} onChange={(e) => setForm((s) => ({ ...s, publisher: e.target.value }))} />
        <select
          className={input}
          value={form.language}
          onChange={(e) => setForm((s) => ({ ...s, language: e.target.value }))}
        >
          <option value="">{t('language') || 'Language'}</option>
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <input className={input} placeholder={t('publishedYear')} value={form.published_year} onChange={(e) => setForm((s) => ({ ...s, published_year: e.target.value }))} />
        <input className={input} type="number" placeholder={t('pages')} value={form.pages} onChange={(e) => setForm((s) => ({ ...s, pages: e.target.value }))} />
      </div>
      <input className={input} placeholder={t('coverUrl')} value={form.cover_url} onChange={(e) => setForm((s) => ({ ...s, cover_url: e.target.value }))} />
      <textarea
        className={`${input} h-auto resize-y py-2`}
        rows={3}
        placeholder={t('editionDescription')}
        value={form.description}
        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
      />
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-lg bg-nonsprimary px-4 py-2 text-sm font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
          <IoCheckmark className="h-4 w-4" />
          {submitLabel}
        </button>
        <button onClick={onCancel} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
          <IoClose className="h-4 w-4" />
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}

// Auto-imports all editions for a book by title + author (OpenLibrary, Google
// Books, FantLab). User can adjust the pre-filled title/author before triggering.
function EditionSearchPanel({
  mediaId,
  initialTitle,
  initialAuthor,
  onDone,
  onClose,
}: {
  mediaId: string
  initialTitle: string
  initialAuthor: string
  onDone: () => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [title, setTitle] = useState(initialTitle)
  const [author, setAuthor] = useState(initialAuthor)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const input =
    'h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  const run = async () => {
    if (!title.trim() && !author.trim()) return
    setBusy(true)
    setErr('')
    setResult(null)
    try {
      const n = await librarianService.autoFindEditions(mediaId, title.trim() || undefined, author.trim() || undefined)
      setResult(n)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-nonsprimary/40 bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text)]">{t('autoFindEditions')}</p>
          <p className="text-xs text-[var(--text-muted)]">OpenLibrary · Google Books · FantLab</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
          <IoClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          className={`${input} w-full`}
          placeholder={t('editionTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }}
        />
        <div className="flex gap-2">
          <input
            className={`${input} flex-1`}
            placeholder={t('author')}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run() }}
          />
          <button
            type="button"
            onClick={run}
            disabled={busy || (!title.trim() && !author.trim())}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            <IoCloudDownloadOutline className="h-4 w-4" />
            {busy ? t('importing') : t('autoFindEditions')}
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}
      {result !== null && (
        <p className="text-xs text-[var(--text-muted)]">
          <IoCheckmark className="inline h-3.5 w-3.5 text-nonsprimary" /> {result > 0 ? `${result} editions imported` : 'No new editions found'}
        </p>
      )}
    </div>
  )
}

// Picker for moving an edition onto a different book work: search the catalog
// for the destination book, or create a new one from the typed title when it
// isn't there yet.
function MoveEditionPicker({
  currentMediaId,
  editionTitle,
  onMove,
  onCancel,
}: {
  currentMediaId: string
  editionTitle?: string
  onMove: (targetMediaId: number) => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const input =
    'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  // Debounced catalog search, books only and never the work we're moving from.
  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const data = await catalogService.getCatalog(q).catch(() => [] as CatalogItem[])
      setResults(data.filter((c) => c.type === 'book' && c.id !== currentMediaId).slice(0, 8))
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q, currentMediaId])

  const run = async (fn: () => Promise<number>) => {
    setBusy(true)
    try {
      await onMove(await fn())
    } finally {
      setBusy(false)
    }
  }

  const moveTo = (item: CatalogItem) => run(async () => Number(item.id))
  const createAndMove = () =>
    run(() => librarianService.createMedia({ type: 'book', title: q.trim() }))

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-nonsprimary/40 bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text)]">{t('moveEditionTitle')}</p>
        <button onClick={onCancel} className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
          <IoClose className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{t('moveEditionHint')}</p>
      {editionTitle && <p className="truncate text-xs text-[var(--text-muted)]">“{editionTitle}”</p>}

      <div className="relative">
        <IoSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input autoFocus className={input} placeholder={t('moveBookPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <p className="py-2 text-sm text-[var(--text-muted)]">{t('loading')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => moveTo(c)}
              disabled={busy}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--container)] p-2 text-left transition-colors hover:border-nonsprimary disabled:opacity-50"
            >
              <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                {c.coverUrl ? <img src={c.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--text)]">{c.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{[c.author, c.year].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="flex-shrink-0 text-xs font-medium text-nonsprimary">{busy ? t('moving') : t('moveHere')}</span>
            </button>
          ))}

          {q.trim() && (
            <button
              onClick={createAndMove}
              disabled={busy}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-nonsprimary px-3 py-2 text-sm font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
            >
              <IoAdd className="h-4 w-4" />
              {busy ? t('creating') : t('createBook', { title: q.trim() })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
