'use client'

import { useState, useEffect, useCallback, Fragment, type ReactNode, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import MediaModal from '../components/MediaModal'
import ProgressModal from '../components/ProgressModal'
import FinishModal from '../components/FinishModal'
import ShelfStatusBar from '../components/ShelfStatusBar'
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import { librarianService } from '../services/librarianService'
import { authedFetch, redirectToNonsLogin } from '../lib/api'
import type { MediaItem, ShelfStatus } from '../types'
import type { CreditPerson, MediaCredits, Edition } from '../lib/mediaMap'
import {
  IoFilmOutline,
  IoBookOutline,
  IoTvOutline,
  IoTimeOutline,
  IoHeart,
  IoHeartOutline,
  IoShareOutline,
  IoArrowBack,
  IoCheckmarkCircle,
  IoCheckmarkCircleOutline,
  IoCreateOutline,
  IoChevronDown,
} from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { isLibrarian } from '../services/librarianService'
import { statusLabel } from '../lib/shelf'

const MOCK_FRIEND_RATINGS = [
  { handle: 'alex', name: 'Alex M.', rating: 8, color: '#6768ab', review: 'Absolutely loved it. The pacing was perfect and the ending hit hard. One of the best I\'ve read this year.' },
  { handle: 'sara', name: 'Sara K.', rating: 9, color: '#f5a623', review: null },
  { handle: 'dima', name: 'Dima V.', rating: 7, color: '#3ec98a', review: 'Good but a bit slow in the middle. Worth it for the final act.' },
]
const MOCK_COMMUNITY = { avg: '4.2', avgRaw: 8.4, count: 1_243 }
const MOCK_COMMUNITY_REVIEWS = [
  { handle: 'maria', name: 'Maria L.', rating: 9, color: '#6768ab', date: 'Jun 2026', text: 'An absolute masterpiece. The worldbuilding is unmatched and the prose flows beautifully — I finished it in two sittings.' },
  { handle: 'james', name: 'James R.', rating: 8, color: '#f5a623', date: 'May 2026', text: 'Really enjoyed it. The character development is the highlight — every person feels fully realised and earned.' },
  { handle: 'anna', name: 'Anna T.', rating: 7, color: '#3ec98a', date: 'May 2026', text: 'Solid, though it drags in the middle third. Push through — the final act is genuinely surprising.' },
  { handle: 'leo', name: 'Leo B.', rating: 10, color: '#e05c5c', date: 'Apr 2026', text: 'Perfect in every way. I don\'t give 10s lightly but this absolutely earned it.' },
  { handle: 'nina', name: 'Nina V.', rating: 6, color: '#4db8c8', date: 'Apr 2026', text: 'Nice but overhyped in my opinion. It\'s good, not great — some chapters felt padded.' },
  { handle: 'omar', name: 'Omar H.', rating: 8, color: '#a067c8', date: 'Mar 2026', text: 'Took a few chapters to click, then I couldn\'t put it down. Beautiful prose throughout.' },
]
const COMM_PER_PAGE = 3

// CreditPerson, MediaCredits and Edition come from ../lib/mediaMap so the
// server-rendered /b and /m pages can share them.

// Series episodes from GET /api/media/:id/episodes — grouped by season, with the
// current user's watched flags keyed by episode id.
interface Episode {
  id: number
  season: number
  number: number
  title?: string
  overview?: string
  air_date?: string
  runtime_min?: number
  still_url?: string
}
interface SeasonGroup {
  season: number
  episodes: Episode[]
}
interface EpisodesResponse {
  seasons: SeasonGroup[]
  watched: Record<string, number> // episode_id -> watched_at
  watched_count: number
  total: number
}

interface MediaOneProps {
  /** SSR mode: public catalog data was fetched on the server (the /b and /m
   *  pages). Skips the authed public fetches and overlays personal signals on
   *  the client. Omitted on the legacy authed /shelf route. */
  ssr?: boolean
  initialItem?: MediaItem | null
  initialCredits?: MediaCredits | null
  initialEditions?: Edition[]
}

export default function MediaOnePage({
  ssr = false,
  initialItem = null,
  initialCredits = null,
  initialEditions = [],
}: MediaOneProps = {}) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [item, setItem] = useState<MediaItem | null>(initialItem)
  const [loading, setLoading] = useState(!initialItem)
  const [credits, setCredits] = useState<MediaCredits | null>(initialCredits)
  const [editions, setEditions] = useState<Edition[]>(initialEditions)
  const [episodes, setEpisodes] = useState<EpisodesResponse | null>(null)
  const [editionId, setEditionId] = useState<number | null>(initialItem?.editionId ?? null)
  const [isbnFind, setIsbnFind] = useState('')

  const [userRating, setUserRating] = useState<number | null>(initialItem?.rating ?? null)
  const [userReview, setUserReview] = useState(initialItem?.review ?? '')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewSaved, setReviewSaved] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)
  const [commPage, setCommPage] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editingReview, setEditingReview] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  const loadItem = useCallback(() => {
    if (!id) return
    libraryService.getItem(id).then((found) => {
      if (found) {
        setItem(found)
        setUserRating(found.rating ?? null)
        setUserReview(found.review ?? '')
        setEditionId(found.editionId ?? null)
      }
      setLoading(false)
    })
  }, [id])

  // SSR pages (/b, /m) already carry the public catalog data from the server;
  // once we know who's signed in, overlay their personal signals
  // (shelf/like/rating/review). Non-SSR routes (legacy /shelf) fetch everything
  // through the authed API as before.
  useEffect(() => {
    if (!ssr) {
      loadItem()
      return
    }
    if (!isAuthenticated || !initialItem) return
    let cancelled = false
    libraryService.getSignals(initialItem.id).then((sig) => {
      if (cancelled) return
      setItem((prev) => (prev ? { ...prev, ...sig } : prev))
      setUserRating(sig.rating ?? null)
      setUserReview(sig.review ?? '')
      setEditionId(sig.editionId ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [ssr, isAuthenticated, initialItem, loadItem])

  // Cast & crew with stable person uuids, for linking to /p/<uuid>. On SSR pages
  // these came from the server already.
  useEffect(() => {
    if (!id || ssr) return
    let cancelled = false
    authedFetch(`/api/media/${id}/credits`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => !cancelled && setCredits(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, ssr])

  // Editions (books) for the metadata section. SSR pages already have them.
  useEffect(() => {
    if (!id || ssr) return
    let cancelled = false
    authedFetch(`/api/media/${id}/editions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setEditions(d?.editions ?? []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, ssr])

  // Episodes (series), grouped by season with the user's watched flags. Only
  // fetched once we know the item is a series.
  useEffect(() => {
    if (!id || item?.type !== 'series') return
    let cancelled = false
    authedFetch(`/api/media/${id}/episodes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setEpisodes(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, item?.type])

  // Mark/unmark an episode watched and reflect it in local state immediately.
  const toggleWatched = async (episodeId: number, watched: boolean) => {
    setEpisodes((prev) => {
      if (!prev) return prev
      const next = { ...prev.watched }
      if (watched) next[episodeId] = Math.floor(Date.now() / 1000)
      else delete next[episodeId]
      return { ...prev, watched: next, watched_count: Object.keys(next).length }
    })
    await authedFetch(`/api/episodes/${episodeId}/watch`, { method: watched ? 'PUT' : 'DELETE' })
  }

  // Mutations go by the numeric catalog id — the route param may be the uuid
  // (from /b/<uuid> and /m/<uuid> URLs), which only the read path resolves.
  const patch = async (updates: Partial<MediaItem>) => {
    if (!item) return
    const updated = await libraryService.updateItem(item.id, updates)
    setItem(updated)
  }

  const handleRatingChange = async (val: number) => {
    setUserRating(val)
    await patch({ rating: val })
  }

  const saveReview = async () => {
    if (!item) return
    setReviewSaving(true)
    setReviewSaved(false)
    try {
      await libraryService.setReview(item.id, userReview)
      setItem((prev) => (prev ? { ...prev, review: userReview } : prev))
      setReviewSaved(true)
    } finally {
      setReviewSaving(false)
    }
  }

  // Select an edition: reflect it in the URL (?e=<edition-uuid>) so the choice is
  // shareable, and — when the book is on the user's shelf — persist it as the
  // edition they're reading. Re-clicking the selected one clears it.
  const chooseEdition = async (e: Edition) => {
    if (!item) return
    const selected = (e.uuid && e.uuid === params.get('e')) || editionId === e.id
    const next = new URLSearchParams(params)
    if (selected) {
      next.delete('e')
      setEditionId(null)
      if (item.status) await libraryService.setEdition(item.id, 0)
    } else {
      if (e.uuid) next.set('e', e.uuid)
      setEditionId(e.id)
      if (item.status) await libraryService.setEdition(item.id, e.id)
    }
    setParams(next, { replace: true })
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
  const isSeries = item.type === 'series'
  const Icon = isBook ? IoBookOutline : isSeries ? IoTvOutline : IoFilmOutline
  const typeLabel = isBook ? t('book') : isSeries ? t('series') : t('film')
  const status = item.status ?? 'wishlist'
  const genres = Array.isArray(item.genre) ? item.genre : item.genre ? [item.genre] : []
  const displayRating = userRating !== null ? `${(userRating / 2).toFixed(1)}/5` : t('unrated')

  // A person rendered as a chip linking to their /p/<uuid> page.
  const personChip = (p: CreditPerson, sub?: string) => (
    <Link
      key={p.uuid}
      to={`/p/${p.uuid}`}
      className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)] transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
    >
      {p.name}
      {sub ? <span className="text-[var(--text-muted)]"> · {sub}</span> : null}
    </Link>
  )

  const crewSection = (label: string, entries?: { person: CreditPerson }[]) =>
    entries && entries.length > 0 ? (
      <div>
        <h3 className="mb-2.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</h3>
        <div className="flex flex-wrap gap-2">{entries.map((e) => personChip(e.person))}</div>
      </div>
    ) : null

  // Byline makers: authors for books, directors for movies — linked when we have
  // credits, otherwise the plain denormalized name.
  const makers = isBook ? credits?.authors : credits?.directors

  // The edition currently in focus: from the ?e=<uuid> URL param, falling back to
  // the user's shelf reading-edition. Its cover/details take over the page.
  const selectedEdition =
    editions.find((e) => e.uuid && e.uuid === params.get('e')) ?? editions.find((e) => e.id === editionId) ?? null
  const coverUrl = selectedEdition?.cover_url || item.coverUrl

  // Interactive controls (shelf, rating, review, favorite, edit) are for signed-in
  // users. Anonymous visitors and crawlers still get the full public content; we
  // show them a sign-in call-to-action instead. While the session check is in
  // flight (and during SSR) we show neither, so the server HTML stays clean.
  const canInteract = isAuthenticated
  const showSignIn = !authLoading && !isAuthenticated
  const signInPrompt = (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <p className="text-sm font-semibold text-[var(--text)]">{t('signInToShelfTitle')}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{t('signInToShelfText')}</p>
      <button
        onClick={() => redirectToNonsLogin()}
        className="mt-3 w-full rounded-xl bg-nonsprimary py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {t('login')}
      </button>
    </div>
  )

  return (
    <Layout>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <IoArrowBack className="h-4 w-4" />
        {t('back')}
      </button>

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* ── Left: cover + actions ── */}
        <div className="flex w-full flex-shrink-0 flex-col gap-3 md:w-64">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {coverUrl ? (
              <img src={coverUrl} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--container-2)]">
                <Icon className="h-10 w-10 text-[var(--placeholder)]" />
              </div>
            )}
          </div>

          {canInteract && (
            <div className="flex gap-2">
              <button
                onClick={() => patch({ favorite: !item.favorite })}
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all ${
                  item.favorite
                    ? 'bg-nonsprimary text-white'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.favorite ? <IoHeart className="h-4 w-4" /> : <IoHeartOutline className="h-4 w-4" />}
                {item.favorite ? t('saved') : t('save')}
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                <IoShareOutline className="h-4 w-4" />
              </button>
              {isLibrarian(user?.role) && (
                <button
                  onClick={() => setEditing(true)}
                  title={t('edit')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
                >
                  <IoCreateOutline className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Status shelf control — signed in; otherwise a sign-in prompt. */}
          {canInteract ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <ShelfStatusBar
                item={item}
                currentStatus={status}
                onStatusChange={(s) => {
                  if (s === 'done') { setFinishOpen(true); return }
                  patch({ status: s })
                }}
                onEditProgress={status === 'active' ? () => setProgressOpen(true) : undefined}
              />
            </div>
          ) : showSignIn ? (
            signInPrompt
          ) : null}
        </div>

        {/* ── Right: info ── */}
        <div className="flex flex-1 flex-col gap-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-[var(--text-muted)]">
              <Icon className="h-3.5 w-3.5" />
              <span>{typeLabel}</span>
              {item.year && (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <span>{item.year}</span>
                </>
              )}
              {!isBook && item.duration && (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <IoTimeOutline className="h-3.5 w-3.5" />
                  <span>{item.duration}</span>
                </>
              )}
              {isBook && item.pages ? (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <span>{t('pagesCount', { count: item.pages })}</span>
                </>
              ) : null}
            </div>

            <div className="mb-2">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text)] md:text-[2.6rem]">
                {item.title}
              </h1>
            </div>

            <p className="text-sm text-[var(--text-muted)]">
              {isBook ? t('writtenBy') : t('directedBy')}{' '}
              {makers && makers.length > 0 ? (
                makers.map((m, i) => (
                  <span key={m.person.uuid}>
                    {i > 0 ? ', ' : ''}
                    <Link to={`/p/${m.person.uuid}`} className="font-medium text-[var(--text)] hover:text-nonsprimary">
                      {m.person.name}
                    </Link>
                  </span>
                ))
              ) : (
                <span className="font-medium text-[var(--text)]">{isBook ? item.author : item.director || item.author}</span>
              )}
            </p>
          </div>

          <hr className="border-[var(--divider)]" />

          <div>
            <h3 className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('synopsis')}</h3>
            <p className="text-sm leading-7 text-[var(--text-muted)]">{item.description || t('noDescription')}</p>
          </div>

          {genres.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('genre')}</h3>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cast & crew, linked to person pages. Falls back to the old plain
              actor strings only when credits haven't loaded. */}
          {credits && credits.cast.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('cast')}</h3>
              <div className="flex flex-wrap gap-2">
                {credits.cast.map((c) => personChip(c.person, c.character))}
              </div>
            </div>
          )}
          {crewSection(t('writers') || 'Writers', credits?.writers)}
          {crewSection(t('translators') || 'Translators', credits?.translators)}

          {!credits && !isBook && item.actors && item.actors.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('cast')}</h3>
              <div className="flex flex-wrap gap-2">
                {item.actors.map((actor) => (
                  <span
                    key={actor}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)]"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Episodes (series), grouped by season, each toggleable as watched.
              Collapsed by default — sits right below cast so it doesn't push
              ratings/reviews off-screen on first load. */}
          {isSeries && episodes && episodes.total > 0 && (
            <div>
              <button
                onClick={() => setEpisodesOpen((v) => !v)}
                className="mb-2.5 flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <IoChevronDown className={`h-3.5 w-3.5 transition-transform ${episodesOpen ? '' : '-rotate-90'}`} />
                  {t('episodes')} ({episodes.total})
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {t('watchedOfTotal', { watched: episodes.watched_count, total: episodes.total })}
                </span>
              </button>
              {episodesOpen && (
              <div className="flex flex-col gap-5">
                {episodes.seasons.map((s) => (
                  <div key={s.season}>
                    <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">
                      {t('season')} {s.season}
                      <span className="ml-2 font-normal text-[var(--text-muted)]">
                        {t('episodesCount', { count: s.episodes.length })}
                      </span>
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {s.episodes.map((ep) => {
                        const watched = !!episodes.watched[ep.id]
                        return (
                          <div
                            key={ep.id}
                            className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"
                          >
                            {ep.still_url ? (
                              <img
                                src={ep.still_url}
                                alt=""
                                loading="lazy"
                                className="h-14 w-24 flex-shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-24 flex-shrink-0 items-center justify-center rounded bg-[var(--container-2)]">
                                <IoTvOutline className="h-5 w-5 text-[var(--placeholder)]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-[var(--text)]">
                                <span className="text-[var(--text-muted)]">{ep.number}. </span>
                                {ep.title || `${t('season')} ${ep.season}`}
                              </p>
                              <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                                {ep.air_date ? <span>{ep.air_date}</span> : null}
                                {ep.runtime_min ? <span>· {ep.runtime_min} min</span> : null}
                              </p>
                              {ep.overview ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{ep.overview}</p>
                              ) : null}
                            </div>
                            {canInteract && (
                              <button
                                onClick={() => toggleWatched(ep.id, !watched)}
                                title={watched ? t('watched') : t('markWatched')}
                                className={`flex-shrink-0 transition-colors ${
                                  watched ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                                }`}
                              >
                                {watched ? (
                                  <IoCheckmarkCircle className="h-6 w-6" />
                                ) : (
                                  <IoCheckmarkCircleOutline className="h-6 w-6" />
                                )}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* Book metadata — all available catalog fields (ISBN, pages, …). */}
          {isBook && (() => {
            const rows: [string, ReactNode][] = []
            const isbn = selectedEdition?.isbn13 || selectedEdition?.isbn10 || item.isbn
            const pages = selectedEdition?.pages || item.pages
            if (isbn) rows.push(['ISBN', isbn])
            if (pages) rows.push([t('pages') || 'Pages', pages])
            if (selectedEdition?.publisher) rows.push([t('publisher') || 'Publisher', selectedEdition.publisher])
            if (selectedEdition?.published_year) rows.push([t('publishedYear') || 'Published', selectedEdition.published_year])
            if (item.year) rows.push([t('firstPublished') || 'First published', item.year])
            if (item.originalLanguage) rows.push([t('originalLanguage') || 'Original language', item.originalLanguage])
            if (item.titleEn && item.titleEn !== item.title) rows.push([t('originalTitle') || 'Original title', item.titleEn])
            if (item.workId) {
              rows.push([
                'OpenLibrary',
                <a href={`https://openlibrary.org${item.workId}`} target="_blank" rel="noreferrer" className="text-nonsprimary hover:underline">
                  {item.workId.replace('/works/', '')}
                </a>,
              ])
            }
            if (rows.length === 0) return null
            return (
              <div>
                <h3 className="mb-2.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('details') || 'Details'}</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  {rows.map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="text-[var(--text-muted)]">{k}</dt>
                      <dd className="break-words text-[var(--text)]">{v}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            )
          })()}

          {/* Editions (Goodreads-style). Each edition is selectable — selecting
              one drives the page (cover/details) and is reflected in the URL
              (?e=<edition-uuid>) so it's shareable; if the book is on the user's
              shelf it's also saved as the edition they're reading. An ISBN box
              jumps to a specific printing. */}
          {isBook && editions.length > 0 && (() => {
            const find = isbnFind.replace(/[^0-9Xx]/g, '')
            const shown = find
              ? editions.filter((e) => (e.isbn13 || '').includes(find) || (e.isbn10 || '').includes(find))
              : editions
            return (
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    {t('editions') || 'Editions'} ({editions.length})
                  </h3>
                  <input
                    value={isbnFind}
                    onChange={(e) => setIsbnFind(e.target.value)}
                    placeholder={t('findByIsbn')}
                    className="h-8 w-40 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  />
                </div>
                <p className="mb-2 text-xs text-[var(--text-muted)]">{t('selectEditionHint')}</p>
                <div className="flex flex-col gap-2">
                  {shown.map((e) => {
                    const selected = selectedEdition?.id === e.id
                    return (
                      <button
                        key={e.id}
                        onClick={() => chooseEdition(e)}
                        className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-nonsprimary ${
                          selected ? 'border-nonsprimary bg-[var(--primary-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface)]'
                        }`}
                      >
                        <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                          {e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate text-[var(--text)]">{e.title || item.title}</p>
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
                          {(e.isbn13 || e.isbn10) && (
                            <p className="text-xs text-[var(--text-muted)]">ISBN {e.isbn13 || e.isbn10}</p>
                          )}
                        </div>
                        {selected ? (
                          <IoCheckmarkCircle className="h-5 w-5 flex-shrink-0 text-nonsprimary" />
                        ) : (
                          <IoCheckmarkCircleOutline className="h-5 w-5 flex-shrink-0 text-[var(--text-muted)]" />
                        )}
                      </button>
                    )
                  })}
                  {shown.length === 0 && <p className="text-xs text-[var(--text-muted)]">{t('noResults')}</p>}
                </div>
              </div>
            )
          })()}

          {/* ── My review ── */}
          {canInteract && (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('yourReview')}</h3>
                  <button
                    onClick={() => setEditingReview(true)}
                    className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] flex items-center gap-1"
                  >
                    <IoCreateOutline className="h-3.5 w-3.5" />
                    {t('edit') || 'Edit'}
                  </button>
                </div>

                <StarsSelector initialValue={userRating} onChange={handleRatingChange} isEditable />

                {userReview ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{userReview}</p>
                ) : (
                  <p className="mt-3 text-sm italic text-[var(--placeholder)]">
                    {t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
                  </p>
                )}

                {editingReview && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
                    <textarea
                      value={userReview}
                      onChange={(e) => { setUserReview(e.target.value); setReviewSaved(false) }}
                      rows={4}
                      autoFocus
                      placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
                      className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                    />
                    <div className="flex items-center justify-end gap-3">
                      {reviewSaved && <span className="text-xs text-[var(--text-muted)]">{t('saved') || 'Saved'}</span>}
                      <button
                        onClick={() => setEditingReview(false)}
                        className="rounded-lg border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={async () => { await saveReview(); setEditingReview(false) }}
                        disabled={reviewSaving || userReview === (item.review ?? '')}
                        className="rounded-lg bg-nonsprimary px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {reviewSaving ? t('saving') || 'Saving…' : t('saveReview') || 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Friends rating ── */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <h3 className="mb-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Friends</h3>
                {MOCK_FRIEND_RATINGS.length === 0 ? (
                  <p className="text-sm text-[var(--placeholder)]">No friends have rated this yet.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                    {MOCK_FRIEND_RATINGS.map((f) => (
                      <FriendRatingRow key={f.handle} f={f} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Community rating ── */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                <h3 className="mb-4 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Community</h3>
                <div className="mb-5 flex items-end gap-4">
                  <span className="text-4xl font-bold text-[var(--text)]">{MOCK_COMMUNITY.avg}</span>
                  <div className="pb-0.5">
                    <StarsSelector initialValue={MOCK_COMMUNITY.avgRaw} isEditable={false} />
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{MOCK_COMMUNITY.count.toLocaleString()} ratings</span>
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                  {MOCK_COMMUNITY_REVIEWS.slice(commPage * COMM_PER_PAGE, (commPage + 1) * COMM_PER_PAGE).map((r) => (
                    <div key={r.handle} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: r.color }}
                        >
                          {r.name[0]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{r.name}</span>
                        <StarsSelector initialValue={r.rating} isEditable={false} />
                        <span className="text-xs text-[var(--text-muted)]">{r.date}</span>
                      </div>
                      <p className="mt-2 pl-10 text-xs leading-6 text-[var(--text-muted)]">{r.text}</p>
                    </div>
                  ))}
                </div>
                {Math.ceil(MOCK_COMMUNITY_REVIEWS.length / COMM_PER_PAGE) > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setCommPage((p) => Math.max(0, p - 1))}
                      disabled={commPage === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)] disabled:opacity-30"
                    >
                      <IoChevronDown className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <span className="min-w-[3rem] text-center text-xs text-[var(--text-muted)]">
                      {commPage + 1} / {Math.ceil(MOCK_COMMUNITY_REVIEWS.length / COMM_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCommPage((p) => Math.min(Math.ceil(MOCK_COMMUNITY_REVIEWS.length / COMM_PER_PAGE) - 1, p + 1))}
                      disabled={(commPage + 1) * COMM_PER_PAGE >= MOCK_COMMUNITY_REVIEWS.length}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)] disabled:opacity-30"
                    >
                      <IoChevronDown className="h-3.5 w-3.5 -rotate-90" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <ProgressModal
        isOpen={progressOpen}
        item={item}
        onClose={() => setProgressOpen(false)}
        onFinish={() => { setProgressOpen(false); setFinishOpen(true) }}
      />
      <FinishModal
        isOpen={finishOpen}
        item={item}
        onClose={() => setFinishOpen(false)}
        onFinished={() => { setFinishOpen(false); loadItem() }}
      />
      <MediaModal
        isOpen={editing}
        catalogOnly
        withEditions
        initialData={item}
        onClose={() => setEditing(false)}
        onSave={async (data) => {
          await librarianService.updateMedia(item.id, data)
          setEditing(false)
          loadItem()
        }}
      />
    </Layout>
  )
}

function FriendRatingRow({ f }: { f: { handle: string; name: string; rating: number; color: string; review: string | null } }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: f.color }}
        >
          {f.name[0]}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{f.name}</span>
        <StarsSelector initialValue={f.rating} isEditable={false} />
      </div>
      {f.review && (
        <p className="mt-2 pl-10 text-xs leading-6 text-[var(--text-muted)]">{f.review}</p>
      )}
    </div>
  )
}
