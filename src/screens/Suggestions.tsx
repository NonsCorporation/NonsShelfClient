'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IconType } from 'react-icons'
import {
  IoBan, IoBookmark, IoCaretUp, IoCheckmarkCircle, IoChatbubbleEllipses, IoConstruct, IoSearch, IoTrashOutline,
} from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import BoringAvatar from '../components/ui/BoringAvatar'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useLanguage } from '../contexts/LanguageContext'
import { ideaService, IDEA_STATUSES, type Idea, type IdeaSort, type IdeaStatus } from '../services/ideaService'

// /suggestions — the site-wishes board: anyone posts an idea, upvotes the ones
// they want, and searches; librarians answer with a status badge (taken / in
// work / done / ignored) and an optional reply.

const TITLE_MAX = 120
const BODY_MAX = 2000
const REPLY_MAX = 1000

const STATUS_META: Record<IdeaStatus, { labelKey: string; color: string; icon: IconType }> = {
  open: { labelKey: 'ideaStatusOpen', color: '#8a8a93', icon: IoChatbubbleEllipses },
  taken: { labelKey: 'ideaStatusTaken', color: '#5b8def', icon: IoBookmark },
  in_work: { labelKey: 'ideaStatusInWork', color: '#d99a2b', icon: IoConstruct },
  done: { labelKey: 'ideaStatusDone', color: '#3ec98a', icon: IoCheckmarkCircle },
  ignored: { labelKey: 'ideaStatusIgnored', color: '#7a7a82', icon: IoBan },
}

function StatusBadge({ status }: { status: IdeaStatus }) {
  const { t } = useLanguage()
  if (status === 'open') return null
  const m = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}
    >
      <m.icon className="h-3 w-3" />
      {t(m.labelKey)}
    </span>
  )
}

export default function SuggestionsPage() {
  const { t, language } = useLanguage()

  // ── Listing: filters live here; the list is replaced when they change and
  // appended to by "Show more".
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<IdeaSort>('top')
  const [status, setStatus] = useState<IdeaStatus | ''>('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [canModerate, setCanModerate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  // Ignore answers to filters that have since changed.
  const seq = useRef(0)
  useEffect(() => {
    const mine = ++seq.current
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    ideaService.listIdeas({ q: debounced, status, sort, page: 1 })
      .then((r) => {
        if (mine !== seq.current) return
        setIdeas(r.ideas); setTotal(r.total); setCanModerate(r.can_moderate)
        setPage(1); setError(null)
      })
      .catch((e: Error) => { if (mine === seq.current) setError(e.message) })
      .finally(() => { if (mine === seq.current) setLoading(false) })
  }, [debounced, status, sort])

  const loadMore = async () => {
    const mine = seq.current
    setLoadingMore(true)
    try {
      const r = await ideaService.listIdeas({ q: debounced, status, sort, page: page + 1 })
      if (mine !== seq.current) return
      setIdeas((prev) => [...prev, ...r.ideas.filter((n) => !prev.some((p) => p.id === n.id))])
      setPage(page + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  const replace = useCallback((idea: Idea) => setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i))), [])

  // ── New idea
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [focused, setFocused] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  const post = async () => {
    if (!title.trim() || posting) return
    setPosting(true)
    setPostError(null)
    try {
      const idea = await ideaService.createIdea(title.trim(), body.trim())
      setTitle(''); setBody(''); setFocused(false)
      // Show it at once when it fits the current view; otherwise a refetch would
      // hide it behind the filters.
      if ((!status || status === 'open') && !debounced.trim()) {
        setIdeas((prev) => [idea, ...prev]); setTotal((n) => n + 1)
      }
    } catch (e) {
      setPostError((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  // ── Voting (optimistic, then reconciled with the server's answer)
  const vote = async (idea: Idea) => {
    const on = !idea.voted
    replace({ ...idea, voted: on, votes: idea.votes + (on ? 1 : -1) })
    try {
      replace(await ideaService.setVote(idea.id, on))
    } catch {
      replace(idea)
    }
  }

  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null)
  const doDelete = async () => {
    const idea = confirmDelete
    setConfirmDelete(null)
    if (!idea) return
    try {
      await ideaService.deleteIdea(idea.id)
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id)); setTotal((n) => Math.max(0, n - 1))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const statusTabs: { key: IdeaStatus | ''; label: string }[] = [
    { key: '', label: t('ideaStatusAll') },
    ...IDEA_STATUSES.map((s) => ({ key: s, label: t(STATUS_META[s].labelKey) })),
  ]

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-5 text-2xl font-bold tracking-tight text-[var(--text)]">{t('siteSuggestionsTitle')}</h1>

        {/* New idea */}
        <div className="mb-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !focused) void post() }}
            maxLength={TITLE_MAX}
            placeholder={t('ideaTitlePlaceholder')}
            className="w-full bg-transparent px-2 py-1.5 text-[15px] font-medium text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none"
          />
          {(focused || title || body) && (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={BODY_MAX}
                rows={3}
                placeholder={t('ideaBodyPlaceholder')}
                className="mt-1 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between gap-3 px-1">
                <span className="text-xs text-red-400" role="alert">{postError}</span>
                <button
                  onClick={() => void post()}
                  disabled={!title.trim() || posting}
                  className="rounded-xl bg-nonsprimary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  {t('ideaPost')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search, sort, status filter */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ideaSearch')}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </div>
            <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1" role="group">
              {(['top', 'new'] as IdeaSort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sort === s ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {t(s === 'top' ? 'ideaSortTop' : 'ideaSortNew')}
                </button>
              ))}
            </div>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {statusTabs.map((s) => (
              <button
                key={s.key || 'all'}
                onClick={() => setStatus(s.key)}
                aria-pressed={status === s.key}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  status === s.key
                    ? 'border-nonsprimary/50 bg-[var(--primary-soft)] text-nonsprimary'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}

        {/* List */}
        {loading ? (
          <div className="flex animate-pulse flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--surface)]" />)}
          </div>
        ) : ideas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
            {debounced.trim() || status ? t('ideaNoMatch') : t('ideaEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                language={language}
                canModerate={canModerate}
                onVote={() => void vote(idea)}
                onDelete={() => setConfirmDelete(idea)}
                onChanged={replace}
              />
            ))}
          </ul>
        )}

        {!loading && ideas.length < total && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-xl border border-[var(--border-subtle)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
            >
              {loadingMore ? t('loading') : t('ideaMore')}
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={t('ideaDeleteTitle')}
          message={t('ideaDeleteText')}
          confirmText={t('delete')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={() => void doDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  )
}

function IdeaCard({
  idea, language, canModerate, onVote, onDelete, onChanged,
}: {
  idea: Idea
  language: string
  canModerate: boolean
  onVote: () => void
  onDelete: () => void
  onChanged: (i: Idea) => void
}) {
  const { t } = useLanguage()
  const [responding, setResponding] = useState(false)
  const [newStatus, setNewStatus] = useState<IdeaStatus>(idea.status)
  const [reply, setReply] = useState(idea.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      onChanged(await ideaService.setStatus(idea.id, newStatus, reply))
      setResponding(false)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // The author may withdraw an idea while it's still open; librarians any.
  const canDelete = canModerate || (idea.mine && idea.status === 'open')
  const date = new Date(idea.created_at * 1000).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' })
  const name = idea.author.name || idea.author.username

  return (
    <li className="flex gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 sm:p-4">
      <button
        onClick={onVote}
        aria-pressed={idea.voted}
        aria-label={idea.voted ? t('ideaUnvote') : t('ideaVote')}
        title={idea.voted ? t('ideaUnvote') : t('ideaVote')}
        className={`flex h-14 w-11 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
          idea.voted
            ? 'border-nonsprimary/60 bg-[var(--primary-soft)] text-nonsprimary'
            : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-nonsprimary/40 hover:text-[var(--text)]'
        }`}
      >
        <IoCaretUp className="h-4 w-4" />
        <span className="text-sm font-semibold leading-none">{idea.votes}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{idea.title}</h2>
          <StatusBadge status={idea.status} />
        </div>
        {idea.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-muted)]">{idea.body}</p>}

        {idea.reply && (
          <div className="mt-2 rounded-xl border-l-[3px] border-nonsprimary bg-[var(--surface)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-nonsprimary">{t('ideaTeamReply')}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--text)]">{idea.reply}</p>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            {idea.author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={idea.author.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : (
              <span className="h-4 w-4 overflow-hidden rounded-full"><BoringAvatar size={16} name={`user-${idea.author.id}`} /></span>
            )}
            {name}
          </span>
          <span>{date}</span>
          {canModerate && (
            <button onClick={() => { setNewStatus(idea.status); setReply(idea.reply ?? ''); setResponding((v) => !v) }} className="font-medium text-nonsprimary hover:underline">
              {t('ideaRespond')}
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} aria-label={t('delete')} title={t('delete')} className="ml-auto text-[var(--text-muted)] hover:text-red-400">
              <IoTrashOutline className="h-4 w-4" />
            </button>
          )}
        </div>

        {canModerate && responding && (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap gap-1.5">
              {IDEA_STATUSES.map((s) => {
                const m = STATUS_META[s]
                const active = newStatus === s
                return (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    aria-pressed={active}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      color: active ? m.color : 'var(--text-muted)',
                      borderColor: active ? m.color : 'var(--border-subtle)',
                      background: active ? `color-mix(in srgb, ${m.color} 14%, transparent)` : 'transparent',
                    }}
                  >
                    <m.icon className="h-3 w-3" />
                    {t(m.labelKey)}
                  </button>
                )
              })}
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={REPLY_MAX}
              rows={2}
              placeholder={t('ideaReplyPlaceholder')}
              className="mt-2 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-red-400" role="alert">{err}</span>
              <div className="flex gap-2">
                <button onClick={() => setResponding(false)} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">{t('cancel')}</button>
                <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-nonsprimary px-4 py-1.5 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50">{t('save')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
