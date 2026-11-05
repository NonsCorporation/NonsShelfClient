'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/router'
import { IoAdd, IoArrowBack, IoCheckmark, IoClose, IoLayersOutline } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import ListCard from '../components/discover/ListCard'
import InfoTooltip from '../components/ui/InfoTooltip'
import { listService } from '../services/listService'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useLists } from '../contexts/ListContext'
import type { CuratedList, CuratedListDiscoverEntry } from '../types'

// All curated lists of one user (/lists?by=<user id>) — the expanded version of
// the "Lists" block in the library sidebar. `by` defaults to the signed-in
// user; `?create` opens the new-list form straight away (used by the "create
// your own list" prompt at the bottom of a public list).
export default function ListsScreen() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { lists: ownLists, loading: ownLoading, createList } = useLists()

  const by = params.get('by')
  const isOwn = !by || (!!user && String(user.id) === by)

  // Someone else's lists come from the public discover feed (they're public
  // reads); the signed-in user's own come from the list context, which also
  // includes lists that are still empty.
  const [other, setOther] = useState<{ by: string; lists: CuratedListDiscoverEntry[] } | null>(null)
  useEffect(() => {
    if (isOwn || !by) return
    let cancelled = false
    listService.discoverLists(200)
      .then((all) => { if (!cancelled) setOther({ by, lists: all.filter((l) => String(l.user_id) === by) }) })
      .catch(() => { if (!cancelled) setOther({ by, lists: [] }) })
    return () => { cancelled = true }
  }, [isOwn, by])
  const otherLoading = other?.by !== by
  const otherLists = other?.by === by ? other.lists : []

  // ── New list ──────────────────────────────────────────────────────────────
  const creating = isOwn && params.has('create')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 30)
  }, [creating])

  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('create', '')
    else next.delete('create')
    setParams(next, { replace: true })
    if (!open) setTitle('')
  }

  async function commitCreate() {
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      const l = await createList(trimmed)
      navigate(`/list/${l.id}`)
    } catch {
      setBusy(false)
    }
  }

  const loading = isOwn ? ownLoading : otherLoading

  return (
    <Layout>
      <div className="mb-6">
        <Link
          to="/library"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IoArrowBack className="h-3.5 w-3.5" />
          {t('library')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--text)]">
              {t('lists')}
              <InfoTooltip text={t('listsInfoTooltip')} />
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('listsPageSubtitle')}</p>
          </div>
          {isOwn && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              <IoAdd className="h-4 w-4" />
              {t('listsNewList')}
            </button>
          )}
        </div>
      </div>

      {creating && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            maxLength={150}
            placeholder={t('listsNamePlaceholder')}
            className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
          <button
            onClick={commitCreate}
            disabled={!title.trim() || busy}
            title={t('create')}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-nonsprimary text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            <IoCheckmark className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCreating(false)}
            title={t('cancel')}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <IoClose className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid animate-pulse grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (isOwn ? ownLists.length : otherLists.length) === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
            <IoLayersOutline className="h-7 w-7 text-[var(--text-muted)]" />
          </div>
          <p className="max-w-sm text-sm text-[var(--text-muted)]">{t('listsPageEmpty')}</p>
        </div>
      ) : isOwn ? (
        <div className="grid animate-fade-up gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ownLists.map((l) => <OwnListRow key={l.id} list={l} t={t} />)}
        </div>
      ) : (
        <div className="grid animate-fade-up grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {otherLists.map((l) => <ListCard key={l.id} list={l} />)}
        </div>
      )}
    </Layout>
  )
}

function OwnListRow({ list, t }: { list: CuratedList; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <Link
      to={`/list/${list.id}`}
      className="group flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-colors hover:border-nonsprimary/50"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimary">
        <IoLayersOutline className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--text)] group-hover:text-nonsprimary">{list.title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('itemsCount', { n: list.count })}</p>
        {list.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{list.description}</p>
        )}
      </div>
    </Link>
  )
}
