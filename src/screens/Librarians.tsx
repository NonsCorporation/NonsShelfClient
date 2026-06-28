import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import MediaModal from '../components/MediaModal'
import ImportSearchModal from '../components/ImportSearchModal'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import { librarianService, isLibrarian } from '../services/librarianService'
import type { PersonSummary } from '../services/librarianService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { suggestionService } from '../services/suggestionService'
import type { Suggestion } from '../services/suggestionService'
import {
  IoSearch,
  IoCreateOutline,
  IoAdd,
  IoCloudDownloadOutline,
  IoFilmOutline,
  IoTvOutline,
  IoPersonOutline,
  IoGitMergeOutline,
  IoOpenOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoTimeOutline,
  IoCheckmark,
  IoClose,
} from 'react-icons/io5'
import type { BulkJob } from '../services/librarianService'
import PersonModal from '../components/PersonModal'
import TypeBadge from '../components/TypeBadge'
import { mediaPath } from '../lib/paths'

type Tab = 'catalog' | 'authors' | 'suggestions'

export default function LibrariansPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('catalog')

  if (!isLibrarian(user?.role)) {
    return (
      <Layout>
        <p className="py-24 text-center text-sm text-[var(--text-muted)]">{t('notAuthorized')}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('librarianDashboard')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('editMetadataSubtitle')}</p>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
        {(['catalog', 'authors', 'suggestions'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--surface-active)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {key === 'catalog' ? t('tabCatalog') : key === 'authors' ? t('tabAuthors') : 'Suggestions'}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? <CatalogTab /> : tab === 'authors' ? <AuthorsTab /> : <SuggestionsTab />}
    </Layout>
  )
}

// ── Catalog tab: search + add + edit catalog entries ──────────────────────────

function CatalogTab() {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editItem, setEditItem] = useState<MediaItem | null>(null)

  // Bulk-merge state
  const [mergeMode, setMergeMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState('')

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(() => {
      catalogService.getCatalog(q.trim()).then((data) => { setResults(data); setLoading(false) })
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const refresh = () => { if (q.trim()) catalogService.getCatalog(q.trim()).then(setResults) }

  const openEdit = async (id: string) => {
    const full = await libraryService.getItem(id)
    if (full) setEditItem(full)
  }

  const handleAdd = async (data: Partial<MediaItem>) => {
    const id = await librarianService.createMedia(data)
    setAdding(false)
    openEdit(String(id))
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const c = new Set(prev); c.has(id) ? c.delete(id) : c.add(id); return c })

  const exitMergeMode = () => { setMergeMode(false); setSelected(new Set()); setMergeError('') }

  const executeMerge = async (keepId: string) => {
    const dups = [...selected].filter((id) => id !== keepId)
    setMerging(true)
    setMergeError('')
    try {
      for (const dupId of dups) await librarianService.mergeMedia(keepId, { id: dupId })
      exitMergeMode()
      refresh()
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  const selectedItems = results.filter((r) => selected.has(r.id))

  return (
    <>
      <BulkImportPanel />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <IoSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchCatalogPlaceholder')}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] py-3 pl-12 pr-4 text-base text-[var(--text)] focus:border-nonsprimary focus:outline-none"
          />
        </div>
        <button
          onClick={() => setImporting(true)}
          disabled={mergeMode}
          className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)] disabled:opacity-40"
        >
          <IoCloudDownloadOutline className="h-5 w-5" />
          {t('importEntry')}
        </button>
        <button
          onClick={() => (mergeMode ? exitMergeMode() : setMergeMode(true))}
          className={`inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition-colors ${
            mergeMode
              ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary hover:bg-nonsprimary/20'
              : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border-subtle)]'
          }`}
        >
          <IoGitMergeOutline className="h-5 w-5" />
          {mergeMode ? 'Exit merge' : 'Merge'}
        </button>
        <button
          onClick={() => setAdding(true)}
          disabled={mergeMode}
          className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-nonsprimary px-5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
        >
          <IoAdd className="h-5 w-5" />
          {t('addEntry')}
        </button>
      </div>

      {/* Merge mode: instruction banner */}
      {mergeMode && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-nonsprimary/40 bg-[var(--primary-soft)] px-4 py-3">
          <p className="text-sm text-[var(--text)]">
            {selected.size < 2
              ? 'Click entries to select duplicates (need 2+)'
              : `${selected.size} selected — choose which entry to keep below`}
          </p>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="flex-shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Merge mode: "keep which?" panel */}
      {mergeMode && selected.size >= 2 && (
        <div className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">
            Keep which entry? The rest will be merged into it and deleted.
          </p>
          {mergeError && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {mergeError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {selectedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                    {item.coverUrl && <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">{item.title}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {(item.type === 'book' ? item.author : item.director || item.author) || ''}
                      {item.year ? ` · ${item.year}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => executeMerge(item.id)}
                  disabled={merging}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  <IoGitMergeOutline className="h-3.5 w-3.5" />
                  {merging ? 'Merging…' : 'Keep'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nonsprimary border-t-transparent" />
        </div>
      ) : !q ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('searchToBegin')}</p>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
      ) : (
        <div className="flex flex-col gap-3 animate-fade-up">
          {results.map((item) => {
            const isSelected = selected.has(item.id)
            return (
              <div
                key={item.id}
                onClick={mergeMode ? () => toggleSelect(item.id) : undefined}
                className={`flex items-center justify-between rounded-2xl border bg-[var(--container)] p-4 transition-colors sm:p-5 ${
                  mergeMode
                    ? isSelected
                      ? 'cursor-pointer border-nonsprimary bg-[var(--primary-soft)]'
                      : 'cursor-pointer border-[var(--border-subtle)] hover:border-nonsprimary/50'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                }`}
              >
                {/* Checkbox indicator in merge mode */}
                {mergeMode && (
                  <div className={`mr-3 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    isSelected ? 'border-nonsprimary bg-nonsprimary' : 'border-[var(--border-strong)] bg-transparent'
                  }`}>
                    {isSelected && <IoCheckmark className="h-3 w-3 text-white" />}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
                  <div className="relative aspect-[2/3] w-14 flex-shrink-0 sm:w-16">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <div className="h-full w-full rounded-lg bg-[var(--surface)]" />
                    )}
                    <TypeBadge type={item.type} position="top-1 right-1" size="h-6 w-6" iconSize="h-3 w-3" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] sm:text-[11px]">
                      <span>{item.type === 'book' ? t('book') : item.type === 'series' ? t('series') : t('film')}</span>
                      {item.year && (
                        <>
                          <span className="text-[var(--border-strong)]">·</span>
                          <span>{item.year}</span>
                        </>
                      )}
                    </div>
                    <h3 className="truncate text-base font-bold text-[var(--text)] sm:text-lg">{item.title}</h3>
                    <p className="truncate text-sm text-[var(--text-muted)]">
                      {item.type === 'book' ? item.author : item.director || item.author}
                    </p>
                  </div>
                </div>

                {!mergeMode && (
                  <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                    <Link
                      to={mediaPath(item)}
                      className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)]"
                    >
                      <IoOpenOutline className="h-5 w-5" />
                      <span className="hidden sm:inline">{t('open') || 'Open'}</span>
                    </Link>
                    <button
                      onClick={() => openEdit(item.id)}
                      className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)]"
                    >
                      <IoCreateOutline className="h-5 w-5" />
                      <span className="hidden sm:inline">{t('edit')}</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <MediaModal
        isOpen={adding}
        initialType="book"
        catalogOnly
        onClose={() => setAdding(false)}
        onSave={handleAdd}
      />

      <MediaModal
        isOpen={!!editItem}
        catalogOnly
        withEditions
        initialData={editItem ?? undefined}
        onClose={() => setEditItem(null)}
        onSave={async (data) => {
          if (!editItem) return
          await librarianService.updateMedia(editItem.id, data)
          setEditItem(null)
          refresh()
        }}
        onDelete={async (id) => {
          if (!window.confirm(t('confirmDeleteEntry'))) return
          await librarianService.deleteMedia(id)
          setEditItem(null)
          refresh()
        }}
      />

      <ImportSearchModal
        isOpen={importing}
        onClose={() => setImporting(false)}
        onImported={(newId) => {
          setImporting(false)
          openEdit(newId)
        }}
      />
    </>
  )
}

// ── Bulk import: top-N popular movies/series from TMDB (background job) ────────

function BulkImportPanel() {
  const { t } = useLanguage()
  const [type, setType] = useState<'movie' | 'series'>('movie')
  const [count, setCount] = useState(100)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<BulkJob | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  // Poll the job while it runs.
  useEffect(() => {
    if (!jobId) return
    let active = true
    const tick = async () => {
      try {
        const j = await librarianService.tmdbBulkStatus(jobId)
        if (!active) return
        setJob(j)
        if (j.status === 'running') setTimeout(tick, 1500)
      } catch {
        if (active) setTimeout(tick, 2500)
      }
    }
    tick()
    return () => {
      active = false
    }
  }, [jobId])

  const start = async () => {
    setError('')
    setJob(null)
    setStarting(true)
    try {
      setJobId(await librarianService.tmdbBulkImport(type, count))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  const running = job?.status === 'running'
  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0
  const presets = [100, 250, 500, 1000]

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <IoCloudDownloadOutline className="h-5 w-5 text-nonsprimary" />
        <h3 className="text-sm font-semibold text-[var(--text)]">{t('bulkTitle')}</h3>
      </div>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t('bulkHint')}</p>

      <div className="flex flex-wrap items-center gap-3">
        {/* Type */}
        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {([
            ['movie', t('movies'), IoFilmOutline],
            ['series', t('seriesPlural'), IoTvOutline],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              disabled={running}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                type === k ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Count presets + custom */}
        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {presets.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              disabled={running}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                count === n ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          max={1000}
          value={count}
          disabled={running}
          onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
          className="h-9 w-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] disabled:opacity-50"
        />

        <button
          onClick={start}
          disabled={running || starting}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-nonsprimary px-4 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
        >
          <IoCloudDownloadOutline className="h-4 w-4" />
          {running ? t('importing') : t('bulkStart')}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      {job && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              {job.processed} / {job.total} · {t('bulkCreated')} {job.created} · {t('bulkSkipped')} {job.skipped}
              {job.failed > 0 ? ` · ${t('bulkFailed')} ${job.failed}` : ''}
              {job.episodes > 0 ? ` · ${job.episodes} ${t('episodes').toLowerCase()}` : ''}
            </span>
            <span className="font-medium text-[var(--text)]">{job.status === 'done' ? t('bulkDoneLabel') : `${pct}%`}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-active)]">
            <div
              className={`h-full rounded-full transition-all ${job.status === 'error' ? 'bg-red-500' : 'bg-nonsprimary'}`}
              style={{ width: `${job.status === 'done' ? 100 : pct}%` }}
            />
          </div>
          {job.status === 'error' && job.error && <p className="mt-2 text-xs text-red-500">{job.error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Authors tab: search + rename + merge duplicates ───────────────────────────

function AuthorsTab() {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<PersonSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [dup, setDup] = useState<PersonSummary | null>(null)
  const [editPerson, setEditPerson] = useState<PersonSummary | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')

  const runSearch = (term: string) => {
    if (!term.trim()) {
      setPeople([])
      return
    }
    setLoading(true)
    librarianService
      .searchPeople(term)
      .then(setPeople)
      .catch(() => setPeople([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(() => runSearch(q), 300)
    return () => clearTimeout(timer)
  }, [q])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleMerge = async (keep: PersonSummary) => {
    if (!dup || dup.uuid === keep.uuid) return
    await librarianService.mergePeople(keep.uuid, dup.uuid)
    setDup(null)
    flash(t('mergedToast'))
    runSearch(q)
  }

  const onSaved = () => {
    setAdding(false)
    setEditPerson(null)
    flash(t('savedToast'))
    runSearch(q)
  }

  return (
    <>
      <div className="mb-4 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <IoSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchAuthorsPlaceholder')}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] py-3 pl-12 pr-4 text-base text-[var(--text)] focus:border-nonsprimary focus:outline-none"
          />
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-nonsprimary px-5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus"
        >
          <IoAdd className="h-5 w-5" />
          {t('addAuthor')}
        </button>
      </div>

      {dup && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-nonsprimary/40 bg-[var(--primary-soft)] px-4 py-3">
          <p className="text-sm text-[var(--text)]">
            <span className="font-semibold">{t('duplicateLabel')}:</span> {dup.name}
            <span className="ml-2 text-[var(--text-muted)]">— {t('mergeAuthorsHint')}</span>
          </p>
          <button
            onClick={() => setDup(null)}
            className="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('clearSelection')}
          </button>
        </div>
      )}

      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-500">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nonsprimary border-t-transparent" />
        </div>
      ) : !q.trim() ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('searchToBegin')}</p>
      ) : people.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {people.map((p) => {
            const isDup = dup?.uuid === p.uuid
            return (
              <div
                key={p.uuid}
                className={`flex items-center justify-between gap-3 rounded-xl border bg-[var(--container)] p-3 transition-colors ${
                  isDup ? 'border-nonsprimary' : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
                      <IoPersonOutline className="h-5 w-5 text-[var(--placeholder)]" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link to={`/p/${p.uuid}`} className="block truncate text-sm font-semibold text-[var(--text)] hover:text-nonsprimary">
                      {p.name}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t('creditsCount', { n: p.credit_count })}
                      {p.birth_year ? ` · b. ${p.birth_year}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {dup && !isDup && (
                    <button
                      onClick={() => handleMerge(p)}
                      title={t('mergeInto')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus"
                    >
                      <IoGitMergeOutline className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('keepLabel')}</span>
                    </button>
                  )}
                  {!dup && (
                    <button
                      onClick={() => setDup(p)}
                      title={t('selectDuplicate')}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      {t('merge')}
                    </button>
                  )}
                  <button
                    onClick={() => setEditPerson(p)}
                    title={t('edit')}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <IoCreateOutline className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PersonModal
        isOpen={adding || !!editPerson}
        person={editPerson}
        onClose={() => {
          setAdding(false)
          setEditPerson(null)
        }}
        onSaved={onSaved}
      />
    </>
  )
}

// ── Suggestions tab: review pending community edits ───────────────────────────

const ACTION_LABELS: Record<string, string> = {
  add_edition: 'Add edition',
  update_edition: 'Edit edition',
  delete_edition: 'Delete edition',
  update_media: 'Edit metadata',
  add_credit: 'Add credit',
  delete_credit: 'Remove credit',
  add_person: 'Add person',
  update_person: 'Edit person',
  set_maker: 'Link primary author/director',
  add_episode: 'Add episode',
  update_episode: 'Edit episode',
  delete_episode: 'Delete episode',
  add_relation: 'Add relation',
  delete_relation: 'Remove relation',
  add_series_item: 'Add to series',
  remove_series_item: 'Remove from series',
  add_franchise_member: 'Add to universe',
  remove_franchise_member: 'Remove from universe',
}

// Payload shapes — one per action type
interface EditionPayload { title?: string; publisher?: string; language?: string; published_year?: number; pages?: number; isbn13?: string; isbn10?: string; cover_url?: string; description?: string }
interface MediaPayload { title?: string; original_title?: string; author?: string; director?: string; year?: number; genres?: string; cover_url?: string; description?: string }
interface CreditPayload { person_uuid?: string; role?: string; character?: string }
interface MakerPayload { person_uuid?: string; role?: string }
interface PersonPayload { name?: string; bio?: string; birth_date?: string; photo_url?: string; name_lang?: string; aliases?: { name: string; lang?: string }[] }
interface EpisodePayload { season?: number; number?: number; title?: string; overview?: string; air_date?: string; runtime_min?: number }
interface RelationPayload { from_media_id?: number; to_media_id?: number; kind?: string; part?: number; note?: string; from_uuid?: string; from_title?: string; from_type?: string; to_uuid?: string; to_title?: string; to_type?: string; direction_label?: string }
interface DeleteRelationPayload { kind?: string; other_title?: string }
interface SeriesItemPayload { series_id?: number; series_name?: string; media_id?: number; position?: number; label?: string }
interface RemoveSeriesPayload { series_name?: string }
interface FranchiseMemberPayload { franchise_id?: number; franchise_name?: string; media_id?: number; order?: number }
interface RemoveFranchisePayload { franchise_name?: string }

// Strips the "/numericId" suffix from compound target IDs to get the media UUID.
function workUUID(targetId?: string) { return (targetId ?? '').split('/')[0] }
function childId(targetId?: string) { return (targetId ?? '').split('/')[1] ?? '' }
function cast<T>(v: unknown) { return v as T }

function WorkLink({ uuid, label = 'Open work' }: { uuid: string; label?: string }) {
  if (!uuid) return null
  return (
    <Link to={`/librarian/edit/${uuid}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-nonsprimary hover:underline">
      <IoOpenOutline className="h-3 w-3" /> {label}
    </Link>
  )
}

function SuggestionBody({ sg }: { sg: Suggestion }) {
  const { action_type: at, target_id: tid, payload } = sg

  if (at === 'add_edition' || at === 'update_edition') {
    const ed = cast<EditionPayload>(payload)
    return (
      <div>
        <div className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
            {ed.cover_url && <img src={ed.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-[var(--text)]">{ed.title || <span className="italic text-[var(--text-muted)]">no title</span>}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {[ed.publisher, ed.published_year, ed.language?.toUpperCase(), ed.pages ? `${ed.pages} pp` : undefined].filter(Boolean).join(' · ')}
            </p>
            {(ed.isbn13 || ed.isbn10) && <p className="text-xs text-[var(--text-muted)]">ISBN {ed.isbn13 || ed.isbn10}</p>}
            {ed.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{ed.description}</p>}
          </div>
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'delete_edition') {
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Remove edition <span className="font-mono text-xs text-[var(--text)]">#{childId(tid)}</span> from catalog
        </p>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'update_media') {
    const m = cast<MediaPayload>(payload)
    return (
      <div>
        <div className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          {m.cover_url && (
            <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
              <img src={m.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            {m.title && <p className="font-medium text-[var(--text)]">{m.title}</p>}
            {m.original_title && m.original_title !== m.title && <p className="text-xs text-[var(--text-muted)]">{m.original_title}</p>}
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {[m.author || m.director, m.year, m.genres].filter(Boolean).join(' · ')}
            </p>
            {m.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{m.description}</p>}
          </div>
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'add_credit') {
    const c = cast<CreditPayload>(payload)
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {c.role && <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text)]">{c.role}</span>}
          {c.person_uuid && <span className="font-mono text-xs text-[var(--text-muted)]">{c.person_uuid}</span>}
          {c.character && <span className="text-xs text-[var(--text-muted)]">as {c.character}</span>}
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'delete_credit') {
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Remove credit <span className="font-mono text-xs text-[var(--text)]">#{childId(tid)}</span>
        </p>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'set_maker') {
    const m = cast<MakerPayload>(payload)
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {m.role && <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text)]">{m.role}</span>}
          {m.person_uuid && <span className="font-mono text-xs text-[var(--text-muted)]">{m.person_uuid}</span>}
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'add_person' || at === 'update_person') {
    const p = cast<PersonPayload>(payload)
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-sm">
        <div className="flex items-center gap-3">
          {p.photo_url && (
            <img src={p.photo_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            {p.name && (
              <p className="font-medium text-[var(--text)]">
                {p.name}
                {p.name_lang && <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--text-muted)]">{p.name_lang}</span>}
              </p>
            )}
            {p.birth_date && <p className="text-xs text-[var(--text-muted)]">b. {p.birth_date}</p>}
          </div>
        </div>
        {p.aliases && p.aliases.length > 0 && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Also: {p.aliases.map((a) => a.name).join(' · ')}
          </p>
        )}
        {p.bio && <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{p.bio}</p>}
        {at === 'update_person' && tid && <WorkLink uuid={tid} />}
      </div>
    )
  }

  if (at === 'add_episode' || at === 'update_episode') {
    const ep = cast<EpisodePayload>(payload)
    return (
      <div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-sm">
          <p className="font-medium text-[var(--text)]">
            {ep.season != null && ep.number != null
              ? `S${String(ep.season).padStart(2, '0')}E${String(ep.number).padStart(2, '0')}`
              : ''}
            {ep.title ? ` — ${ep.title}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {[ep.air_date, ep.runtime_min ? `${ep.runtime_min} min` : undefined].filter(Boolean).join(' · ')}
          </p>
          {ep.overview && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{ep.overview}</p>}
        </div>
        <WorkLink uuid={workUUID(tid)} label="Open series" />
      </div>
    )
  }

  if (at === 'delete_episode') {
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Delete episode <span className="font-mono text-xs text-[var(--text)]">#{childId(tid)}</span>
        </p>
        <WorkLink uuid={workUUID(tid)} label="Open series" />
      </div>
    )
  }

  if (at === 'add_relation') {
    const r = cast<RelationPayload>(payload)
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          {r.from_uuid && r.from_type ? (
            <Link
              to={mediaPath({ type: r.from_type as 'book' | 'movie' | 'series', uuid: r.from_uuid, id: r.from_uuid })}
              className="min-w-0 flex-1 truncate text-sm font-medium text-nonsprimary hover:underline"
            >
              {r.from_title ?? r.from_uuid}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{r.from_title ?? '—'}</span>
          )}
          <span className="flex-shrink-0 rounded-full bg-[var(--container-2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {r.direction_label ?? r.kind ?? '→'}
          </span>
          {r.to_uuid && r.to_type ? (
            <Link
              to={mediaPath({ type: r.to_type as 'book' | 'movie' | 'series', uuid: r.to_uuid, id: r.to_uuid })}
              className="min-w-0 flex-1 truncate text-right text-sm font-medium text-nonsprimary hover:underline"
            >
              {r.to_title ?? r.to_uuid}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-[var(--text)]">{r.to_title ?? '—'}</span>
          )}
        </div>
        {(r.part != null && r.part > 0 || r.note) && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {r.part != null && r.part > 0 ? `Part ${r.part}` : ''}{r.note ? ` — ${r.note}` : ''}
          </p>
        )}
      </div>
    )
  }

  if (at === 'delete_relation') {
    const r = cast<DeleteRelationPayload>(payload)
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">Remove</span>
          {r.kind && <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs font-medium uppercase text-[var(--text-muted)]">{r.kind}</span>}
          {r.other_title && <span className="text-sm text-[var(--text)]">{r.other_title}</span>}
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'add_series_item') {
    const s = cast<SeriesItemPayload>(payload)
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {s.series_name && <span className="text-sm font-medium text-[var(--text)]">{s.series_name}</span>}
          {s.position != null && <span className="text-xs text-[var(--text-muted)]">position #{s.position}</span>}
          {s.label && <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{s.label}</span>}
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'remove_series_item') {
    const s = cast<RemoveSeriesPayload>(payload)
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Remove from series <span className="font-medium text-[var(--text)]">{s.series_name ?? ''}</span>
        </p>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'add_franchise_member') {
    const f = cast<FranchiseMemberPayload>(payload)
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {f.franchise_name && <span className="text-sm font-medium text-[var(--text)]">{f.franchise_name}</span>}
          {f.order != null && <span className="text-xs text-[var(--text-muted)]">order {f.order}</span>}
        </div>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  if (at === 'remove_franchise_member') {
    const f = cast<RemoveFranchisePayload>(payload)
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Remove from universe <span className="font-medium text-[var(--text)]">{f.franchise_name ?? ''}</span>
        </p>
        <WorkLink uuid={workUUID(tid)} />
      </div>
    )
  }

  return (
    <pre className="max-h-40 overflow-auto rounded-lg bg-[var(--surface)] p-3 text-xs text-[var(--text)]">
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

function SuggestionsTab() {
  const [items, setItems] = useState<Suggestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = () => {
    setLoading(true)
    suggestionService
      .list({ status: statusFilter, limit: 50 })
      .then(({ items: s, total: t }) => { setItems(s); setTotal(t) })
      .catch(() => setError('Failed to load suggestions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id: number) => {
    setBusy(id)
    setError('')
    try {
      await suggestionService.approve(id)
      flash('Suggestion approved and applied')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const reject = async () => {
    if (!rejectingId) return
    setBusy(rejectingId)
    setError('')
    try {
      await suggestionService.reject(rejectingId, rejectNote)
      setRejectingId(null)
      setRejectNote('')
      flash('Suggestion rejected')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {/* Status filter */}
      <div className="mb-4 inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              statusFilter === s
                ? 'bg-[var(--surface-active)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      )}
      {toast && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          {toast}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-nonsprimary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">
          No {statusFilter} suggestions
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-muted)]">{total} suggestion{total !== 1 ? 's' : ''}</p>
          {items.map((sg) => (
            <div
              key={sg.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {sg.user_handle && (
                    <Link
                      to={`/u/${sg.user_handle}`}
                      className="flex-shrink-0 text-xs font-semibold text-nonsprimary hover:underline"
                    >
                      @{sg.user_handle}
                    </Link>
                  )}
                  <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                    {ACTION_LABELS[sg.action_type] ?? sg.action_type}
                  </span>
                </div>
                <span className="flex flex-shrink-0 items-center gap-1 text-xs text-[var(--text-muted)]">
                  <IoTimeOutline className="h-3 w-3" />
                  {new Date(sg.created_at * 1000).toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="mb-3">
                <SuggestionBody sg={sg} />
              </div>

              {sg.note && (
                <p className="mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm italic text-[var(--text-muted)]">
                  "{sg.note}"
                </p>
              )}

              {sg.status === 'pending' && (
                rejectingId === sg.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      className="h-16 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                      placeholder="Optional rejection reason…"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={reject}
                        disabled={busy === sg.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <IoCloseCircleOutline className="h-4 w-4" />
                        {busy === sg.id ? 'Rejecting…' : 'Confirm reject'}
                      </button>
                      <button
                        onClick={() => setRejectingId(null)}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(sg.id)}
                      disabled={busy === sg.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
                    >
                      <IoCheckmarkCircleOutline className="h-4 w-4" />
                      {busy === sg.id ? 'Applying…' : 'Approve & apply'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(sg.id); setRejectNote('') }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <IoCloseCircleOutline className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )
              )}

              {sg.status !== 'pending' && (
                <div className="flex items-center gap-1.5 text-xs">
                  {sg.status === 'approved' ? (
                    <IoCheckmarkCircleOutline className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <IoCloseCircleOutline className="h-4 w-4 text-red-400" />
                  )}
                  <span className={sg.status === 'approved' ? 'text-emerald-600' : 'text-red-400'}>
                    {sg.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  {sg.review_note && (
                    <span className="text-[var(--text-muted)]"> — {sg.review_note}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
