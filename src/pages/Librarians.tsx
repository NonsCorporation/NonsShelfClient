import { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import MediaModal from '../components/MediaModal'
import ImportSearchModal from '../components/ImportSearchModal'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { librarianService, isLibrarian } from '../services/librarianService'
import type { PersonSummary } from '../services/librarianService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import {
  IoSearch,
  IoCreateOutline,
  IoAdd,
  IoCloudDownloadOutline,
  IoPersonOutline,
  IoGitMergeOutline,
  IoCheckmark,
  IoClose,
} from 'react-icons/io5'

type Tab = 'catalog' | 'authors'

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
        {(['catalog', 'authors'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--surface-active)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {key === 'catalog' ? t('tabCatalog') : t('tabAuthors')}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? <CatalogTab /> : <AuthorsTab />}
    </Layout>
  )
}

// ── Catalog tab: search + add + edit catalog entries ──────────────────────────

function CatalogTab() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!q) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      catalogService.getCatalog(q).then((data) => {
        setResults(data)
        setLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setParams(val ? { q: val } : {})
  }

  // Create a catalog row (no shelving), then jump into its editor to link the
  // author and editions.
  const handleAdd = async (data: Partial<MediaItem>) => {
    const id = await librarianService.createMedia(data)
    setAdding(false)
    navigate(`/librarian/edit/${id}`)
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <IoSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={q}
            onChange={handleSearch}
            placeholder={t('searchCatalogPlaceholder')}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] py-3 pl-12 pr-4 text-base text-[var(--text)] focus:border-nonsprimary focus:outline-none"
          />
        </div>
        <button
          onClick={() => setImporting(true)}
          className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)]"
        >
          <IoCloudDownloadOutline className="h-5 w-5" />
          {t('importEntry')}
        </button>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-nonsprimary px-5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus"
        >
          <IoAdd className="h-5 w-5" />
          {t('addEntry')}
        </button>
      </div>

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
          {results.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-colors hover:border-[var(--border)] sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-20 w-14 flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-16"
                  />
                ) : (
                  <div className="h-20 w-14 flex-shrink-0 rounded-lg bg-[var(--surface)] sm:h-24 sm:w-16" />
                )}
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

              <Link
                to={`/librarian/edit/${item.id}`}
                className="ml-4 flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)]"
              >
                <IoCreateOutline className="h-5 w-5" />
                <span className="hidden sm:inline">{t('edit')}</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      <MediaModal
        isOpen={adding}
        initialType="book"
        catalogOnly
        onClose={() => setAdding(false)}
        onSave={handleAdd}
      />

      <ImportSearchModal
        isOpen={importing}
        onClose={() => setImporting(false)}
        onImported={(newId) => {
          setImporting(false)
          navigate(`/librarian/edit/${newId}`)
        }}
      />
    </>
  )
}

// ── Authors tab: search + rename + merge duplicates ───────────────────────────

function AuthorsTab() {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<PersonSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [dup, setDup] = useState<PersonSummary | null>(null)
  const [editing, setEditing] = useState<{ uuid: string; name: string } | null>(null)
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

  const handleRename = async () => {
    if (!editing) return
    await librarianService.updatePerson(editing.uuid, { name: editing.name })
    setEditing(null)
    runSearch(q)
  }

  const handleCreate = async () => {
    const name = q.trim()
    if (!name) return
    await librarianService.createPerson({ name })
    flash(t('savedToast'))
    runSearch(q)
  }

  const term = q.trim()
  const exactMatch = people.some((p) => p.name.toLowerCase() === term.toLowerCase())

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
        {term && !loading && !exactMatch && (
          <button
            onClick={handleCreate}
            className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-nonsprimary px-5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus"
          >
            <IoAdd className="h-5 w-5" />
            {t('createAuthor')}
          </button>
        )}
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
                    {editing?.uuid === p.uuid ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editing.name}
                          onChange={(e) => setEditing({ uuid: p.uuid, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                          className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                        />
                        <button onClick={handleRename} className="text-emerald-500 hover:opacity-80">
                          <IoCheckmark className="h-5 w-5" />
                        </button>
                        <button onClick={() => setEditing(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                          <IoClose className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Link to={`/p/${p.uuid}`} className="block truncate text-sm font-semibold text-[var(--text)] hover:text-nonsprimary">
                          {p.name}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">
                          {t('creditsCount', { n: p.credit_count })}
                          {p.birth_year ? ` · b. ${p.birth_year}` : ''}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {editing?.uuid !== p.uuid && (
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
                      onClick={() => setEditing({ uuid: p.uuid, name: p.name })}
                      title={t('rename')}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <IoCreateOutline className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
