import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import MediaModal from '../components/MediaModal'
import { libraryService } from '../services/libraryService'
import { catalogService } from '../services/catalogService'
import { authedFetch } from '../lib/api'
import type { CatalogItem } from '../services/catalogService'
import { librarianService, isLibrarian } from '../services/librarianService'
import type { Edition, PersonSummary } from '../services/librarianService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import {
  IoArrowBack,
  IoCreateOutline,
  IoPersonOutline,
  IoTrashOutline,
  IoAdd,
  IoSearch,
  IoGitMergeOutline,
  IoLinkOutline,
} from 'react-icons/io5'

export default function LibrarianEditPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()

  const [item, setItem] = useState<MediaItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingMeta, setEditingMeta] = useState(false)
  const [editions, setEditions] = useState<Edition[]>([])
  const [toast, setToast] = useState('')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(() => {
    libraryService.getItem(id).then((found) => {
      setItem(found ?? null)
      setLoading(false)
    })
  }, [id])

  const loadEditions = useCallback(() => {
    fetchEditions(id).then(setEditions)
  }, [id])

  useEffect(() => {
    load()
    loadEditions()
  }, [load, loadEditions])

  if (!isLibrarian(user?.role)) {
    return (
      <Layout>
        <p className="py-24 text-center text-sm text-[var(--text-muted)]">{t('notAuthorized')}</p>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div>
      </Layout>
    )
  }
  if (!item) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound')}</div>
      </Layout>
    )
  }

  const isBook = item.type === 'book'
  const makerRole: 'author' | 'director' = isBook ? 'author' : 'director'

  const handleSaveMeta = async (data: Partial<MediaItem>) => {
    await librarianService.updateMedia(id, data)
    setEditingMeta(false)
    flash(t('savedToast'))
    load()
  }

  const handleLinkMaker = async (person: PersonSummary) => {
    await librarianService.setMaker(id, person.uuid, makerRole)
    flash(t('makerLinked'))
    load()
  }

  const handleAddEdition = async (e: Partial<Edition>) => {
    await librarianService.addEdition(id, e)
    fetchEditions(id).then(setEditions)
  }

  const handleRemoveEdition = async (editionId: number) => {
    await librarianService.deleteEdition(id, editionId)
    setEditions((eds) => eds.filter((x) => x.id !== editionId))
  }

  const handleMergeDuplicate = async (dup: CatalogItem) => {
    await librarianService.mergeMedia(id, { id: dup.id })
    flash(t('savedToast'))
    fetchEditions(id).then(setEditions)
  }

  const handleDelete = async () => {
    if (!window.confirm(t('confirmDeleteEntry'))) return
    await librarianService.deleteMedia(id)
    navigate('/librarians')
  }

  return (
    <Layout>
      <button
        onClick={() => navigate('/librarians')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <IoArrowBack className="h-4 w-4" />
        {t('back')}
      </button>

      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-500">
          {toast}
        </div>
      )}

      {/* Header summary */}
      <div className="mb-8 flex items-start gap-5">
        <div className="h-32 w-22 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)]" style={{ width: '5.5rem' }}>
          {item.coverUrl ? <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {isBook ? t('book') : t('film')}
            {item.year ? ` · ${item.year}` : ''}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-[var(--text)]">{item.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{isBook ? item.author : item.director || item.author}</p>
          <Link to={`/${isBook ? 'b' : 'm'}/${item.uuid ?? item.id}`} className="mt-2 inline-block text-xs text-nonsprimary hover:underline">
            {t('viewProfile')} →
          </Link>
        </div>
        <button
          onClick={() => setEditingMeta(true)}
          className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-xl bg-nonsprimary px-4 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus"
        >
          <IoCreateOutline className="h-5 w-5" />
          {t('metadata')}
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Link the author/director to a person */}
        <Section title={t('linkAuthorTitle')} hint={t('linkAuthorHint')}>
          {item.makerUuid && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]">
              <IoLinkOutline className="h-4 w-4 text-nonsprimary" />
              {t('linkedAuthor')}:{' '}
              <Link to={`/p/${item.makerUuid}`} className="font-medium text-nonsprimary hover:underline">
                {isBook ? item.author : item.director || item.author}
              </Link>
            </p>
          )}
          <PersonAutocomplete onPick={handleLinkMaker} actionLabel={t('linkMaker')} />
        </Section>

        {/* Editions (books) */}
        {isBook && (
          <Section title={t('editionsTitle')}>
            {editions.length === 0 ? (
              <p className="mb-4 text-sm text-[var(--text-muted)]">{t('noEditionsYet')}</p>
            ) : (
              <div className="mb-4 flex flex-col gap-2">
                {editions.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5">
                    <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                      {e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate text-[var(--text)]">{e.title || item.title}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {[e.publisher, e.published_year || undefined, (e.language || '').toUpperCase() || undefined].filter(Boolean).join(' · ')}
                      </p>
                      {(e.isbn13 || e.isbn10) && <p className="text-xs text-[var(--text-muted)]">ISBN {e.isbn13 || e.isbn10}</p>}
                    </div>
                    <button
                      onClick={() => handleRemoveEdition(e.id)}
                      title={t('removeEdition')}
                      className="flex-shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                    >
                      <IoTrashOutline className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <EditionForm onAdd={handleAddEdition} />
          </Section>
        )}

        {/* Merge a duplicate entry into this one */}
        <Section title={t('mergeDuplicateTitle')} hint={t('mergeDuplicateHint')}>
          <MediaAutocomplete type={item.type} excludeId={item.id} onPick={handleMergeDuplicate} actionLabel={t('mergeHere')} />
        </Section>

        {/* Danger zone */}
        <Section title="">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20"
          >
            <IoTrashOutline className="h-4 w-4" />
            {t('deleteEntry')}
          </button>
        </Section>
      </div>

      <MediaModal
        isOpen={editingMeta}
        catalogOnly
        initialData={item}
        onClose={() => setEditingMeta(false)}
        onSave={handleSaveMeta}
      />
    </Layout>
  )
}

// Reads a work's editions through the same public endpoint the book page uses.
async function fetchEditions(id: string): Promise<Edition[]> {
  try {
    const res = await authedFetch(`/api/media/${id}/editions`)
    if (!res.ok) return []
    const data = (await res.json()) as { editions?: Edition[] }
    return data.editions ?? []
  } catch {
    return []
  }
}

// ── small building blocks ─────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5">
      {title && <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>}
      {hint && <p className="mb-3 mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
      <div className={hint ? '' : title ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}

// Author search → pick a person to link as the maker.
function PersonAutocomplete({ onPick, actionLabel }: { onPick: (p: PersonSummary) => void; actionLabel: string }) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PersonSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      librarianService
        .searchPeople(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div>
      <div className="relative max-w-md">
        <IoSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchAuthorsPlaceholder')}
          className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-10 pr-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {loading && <p className="mt-2 text-xs text-[var(--text-muted)]">…</p>}
      {results.length > 0 && (
        <div className="mt-2 flex max-w-md flex-col gap-1.5">
          {results.map((p) => (
            <div key={p.uuid} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--container-2)]">
                    <IoPersonOutline className="h-4 w-4 text-[var(--placeholder)]" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--text)]">{p.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t('creditsCount', { n: p.credit_count })}</p>
                </div>
              </div>
              <button
                onClick={() => onPick(p)}
                className="flex-shrink-0 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus"
              >
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Catalog search → pick a duplicate work (same type, not self) to merge.
function MediaAutocomplete({
  type,
  excludeId,
  onPick,
  actionLabel,
}: {
  type: MediaItem['type']
  excludeId: string
  onPick: (m: CatalogItem) => void
  actionLabel: string
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      catalogService
        .getCatalog(q)
        .then((data) => setResults(data.filter((m) => m.type === type && m.id !== excludeId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, type, excludeId])

  return (
    <div>
      <div className="relative max-w-md">
        <IoSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchCatalogPlaceholder')}
          className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-10 pr-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {loading && <p className="mt-2 text-xs text-[var(--text-muted)]">…</p>}
      {results.length > 0 && (
        <div className="mt-2 flex max-w-md flex-col gap-1.5">
          {results.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                  {m.coverUrl ? <img src={m.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--text)]">{m.title}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {(type === 'book' ? m.author : m.director || m.author) || ''}
                    {m.year ? ` · ${m.year}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onPick(m)}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus"
              >
                <IoGitMergeOutline className="h-3.5 w-3.5" />
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Inline form to add a new edition to the work.
function EditionForm({ onAdd }: { onAdd: (e: Partial<Edition>) => Promise<void> }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ title: '', publisher: '', language: '', published_year: '', isbn13: '' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await onAdd({
        title: form.title || undefined,
        publisher: form.publisher || undefined,
        language: form.language || undefined,
        published_year: form.published_year ? parseInt(form.published_year, 10) : undefined,
        isbn13: form.isbn13.replace(/[^0-9Xx]/g, '') || undefined,
      })
      setForm({ title: '', publisher: '', language: '', published_year: '', isbn13: '' })
    } finally {
      setBusy(false)
    }
  }

  const input = 'h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={input} placeholder={t('editionTitle')} value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
        <input className={input} placeholder={t('publisher')} value={form.publisher} onChange={(e) => setForm((s) => ({ ...s, publisher: e.target.value }))} />
        <input className={input} placeholder="ISBN" value={form.isbn13} onChange={(e) => setForm((s) => ({ ...s, isbn13: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder={t('language')} value={form.language} onChange={(e) => setForm((s) => ({ ...s, language: e.target.value }))} />
          <input className={input} placeholder={t('publishedYear')} value={form.published_year} onChange={(e) => setForm((s) => ({ ...s, published_year: e.target.value }))} />
        </div>
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border-subtle)] disabled:opacity-50"
      >
        <IoAdd className="h-4 w-4" />
        {t('addEdition')}
      </button>
    </div>
  )
}
