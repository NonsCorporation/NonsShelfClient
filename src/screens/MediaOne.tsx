'use client'

import { useState, useEffect, useCallback, Fragment, type ReactNode, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import { DetailPageSkeleton } from '../components/Skeletons'
import MediaModal from '../components/MediaModal'
import ProgressModal from '../components/ProgressModal'
import FinishModal from '../components/FinishModal'
import ShelfStatusBar from '../components/ShelfStatusBar'
import ReadingDates from '../components/ReadingDates'
import ReadingProgress from '../components/ReadingProgress'
import MediaHistory from '../components/MediaHistory'
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import { librarianService } from '../services/librarianService'
import { getReviews, type ReviewsPage, type CommunityReview } from '../services/reviewService'
import ShareModal from '../components/ShareModal'
import { getFriendUsers, colorFor } from '../services/activityService'
import type { Activity } from '../services/activityService'
import { userPath } from '../lib/paths'
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
  IoPencilOutline,
  IoLockClosedOutline,
  IoChevronDown,
  IoChevronBack,
  IoChevronForward,
} from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { FiClipboard } from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import { isLibrarian } from '../services/librarianService'
import { statusLabel } from '../lib/shelf'
import TypeBadge from '../components/TypeBadge'
import BoringAvatar from '../components/BoringAvatar'

type CommSort = 'newest' | 'oldest' | 'high' | 'low'

// Compact "Mon YYYY" label for a review's date (unix seconds).
function reviewDate(unixSeconds: number): string {
  if (!unixSeconds) return ''
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
const COMM_PER_PAGE = 10
const EDITIONS_PER_PAGE = 12

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
  const [editionsTotal, setEditionsTotal] = useState(initialEditions.length)
  const [editionsLoadingMore, setEditionsLoadingMore] = useState(false)
  // Highest editions page fetched so far — tracked explicitly so "load more"
  // advances reliably (deriving it from editions.length breaks once dedupe
  // leaves a non-page-multiple count).
  const editionsPageRef = useRef(0)
  const [episodes, setEpisodes] = useState<EpisodesResponse | null>(null)
  const [editionId, setEditionId] = useState<number | null>(initialItem?.editionId ?? null)
  // The user's chosen reading edition's own cover/title/pages, carried from their
  // shelf signals. Used to show that printing's cover even when the edition isn't
  // in the carousel page that's been loaded yet.
  const [readingEdition, setReadingEdition] = useState<{ cover?: string; title?: string; pages?: number } | null>(null)
  const [isbnFind, setIsbnFind] = useState('')
  const [selectedLang, setSelectedLang] = useState('')

  const [userRating, setUserRating] = useState<number | null>(initialItem?.rating ?? null)
  const [userReview, setUserReview] = useState(initialItem?.review ?? '')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewSaved, setReviewSaved] = useState(false)
  const [userNote, setUserNote] = useState(initialItem?.note ?? '')
  const [editingNote, setEditingNote] = useState(false)
  const [noteEditText, setNoteEditText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)
  const [commPage, setCommPage] = useState(0)
  const [commSort, setCommSort] = useState<CommSort>('newest')
  const [commWithReview, setCommWithReview] = useState(false)
  const [reviewsPage, setReviewsPage] = useState<ReviewsPage>({ items: [], total: 0, average: 0, count: 0 })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [friendUsers, setFriendUsers] = useState<Map<number, Activity['user']>>(new Map())
  const [friendReviews, setFriendReviews] = useState<CommunityReview[]>([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const commSectionRef = useRef<HTMLDivElement>(null)
  const editionsRef = useRef<HTMLDivElement>(null)
  const scrollEditions = (dir: number) => editionsRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
  const [shareOpen, setShareOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingReview, setEditingReview] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  // Bumped when the progress modal closes, so the reading-progress log refetches.
  const [progressRefresh, setProgressRefresh] = useState(0)

  const loadItem = useCallback(() => {
    if (!id) return
    libraryService.getItem(id).then((found) => {
      if (found) {
        setItem(found)
        setUserRating(found.rating ?? null)
        setUserReview(found.review ?? '')
        setUserNote(found.note ?? '')
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
      // Signals carry unix seconds; MediaItem holds ISO strings for dates.
      const toIso = (s?: number) => (s ? new Date(s * 1000).toISOString() : undefined)
      setItem((prev) =>
        prev ? { ...prev, ...sig, startedAt: toIso(sig.startedAt), finishedAt: toIso(sig.finishedAt) } : prev,
      )
      setUserRating(sig.rating ?? null)
      setUserReview(sig.review ?? '')
      setUserNote(sig.note ?? '')
      setEditionId(sig.editionId ?? null)
      setReadingEdition(
        sig.editionId ? { cover: sig.editionCover, title: sig.editionTitle, pages: sig.editionPages } : null,
      )
    })
    return () => {
      cancelled = true
    }
  }, [ssr, isAuthenticated, initialItem, loadItem])

  // Cast & crew with stable person uuids, for linking to /p/<uuid>. Re-fetches
  // when the selected edition's language changes so person names are localized
  // to that language (using aliases when available, falling back to canonical).
  useEffect(() => {
    if (!id) return
    let cancelled = false
    const url = selectedLang ? `/api/media/${id}/credits?lang=${selectedLang}` : `/api/media/${id}/credits`
    authedFetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => !cancelled && c && setCredits(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, selectedLang])

  // Editions (books) for the metadata section, loaded a page at a time. Always
  // refetches the first page on the client — even on SSR pages, where
  // `initialEditions` is only the first paint — so newly imported editions show
  // up without waiting for a fresh server render. More are pulled on demand via
  // the "load more" control.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    authedFetch(`/api/media/${id}/editions?page=0&limit=${EDITIONS_PER_PAGE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const eds: Edition[] = d.editions ?? []
        setEditions(eds)
        setEditionsTotal(d.total ?? eds.length)
        editionsPageRef.current = 0
        // Restore the selected language from the active edition so the
        // credits byline is localized on page load. Check both the URL UUID
        // (?e=<uuid>) and the shelf's numeric editionId — whichever is set.
        const eUuid = params.get('e')
        const activeEd = eUuid
          ? eds.find((e) => e.uuid === eUuid)
          : editionId
            ? eds.find((e) => e.id === editionId)
            : null
        if (activeEd?.language) setSelectedLang(activeEd.language)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  // Community ratings & reviews — server-computed (aggregate score + a sorted,
  // filtered, paginated page of reviewers). Refetches when the work changes or
  // the sort/filter/page controls change. Keyed by the numeric catalog id so an
  // unrelated `item` overlay (e.g. the user's own rating) doesn't refetch.
  const mediaNumId = item?.id
  useEffect(() => {
    if (!mediaNumId) return
    let cancelled = false
    setReviewsLoading(true)
    getReviews(mediaNumId, { sort: commSort, withReview: commWithReview, page: commPage, perPage: COMM_PER_PAGE })
      .then((p) => { if (!cancelled) setReviewsPage(p) })
      .finally(() => { if (!cancelled) setReviewsLoading(false) })
    return () => {
      cancelled = true
    }
  }, [mediaNumId, commSort, commWithReview, commPage])

  // Friends' ratings/reviews for this media item. Loads once per page visit:
  // fetches the friend list from nons-server, then pulls their ratings for this
  // specific catalog item. Only runs when authenticated.
  const userId = user?.id
  useEffect(() => {
    if (!isAuthenticated || !userId || !mediaNumId) return
    let cancelled = false
    const me = { id: userId, name: user?.name || user?.username || '', handle: user?.username || '', uuid: user?.uuid }
    getFriendUsers(me).then((map) => {
      if (cancelled) return
      setFriendUsers(map)
      setFriendsLoaded(true)
      if (map.size === 0) return
      const userIds = [...map.keys()]
      getReviews(mediaNumId, { userIds, perPage: userIds.length + 1 })
        .then((p) => { if (!cancelled) setFriendReviews(p.items) })
    })
    return () => { cancelled = true }
  }, [isAuthenticated, userId, mediaNumId])

  // Append the next page of editions to the carousel.
  const loadMoreEditions = useCallback(() => {
    if (!id || editionsLoadingMore) return
    const page = editionsPageRef.current + 1
    setEditionsLoadingMore(true)
    authedFetch(`/api/media/${id}/editions?page=${page}&limit=${EDITIONS_PER_PAGE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        editionsPageRef.current = page
        setEditions((prev) => {
          // Dedupe by id in case pages overlap (e.g. a new edition shifted paging).
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...((d.editions ?? []) as Edition[]).filter((e) => !seen.has(e.id))]
        })
        setEditionsTotal(d.total ?? editionsTotal)
      })
      .catch(() => {})
      .finally(() => setEditionsLoadingMore(false))
  }, [id, editionsLoadingMore, editionsTotal])

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

  const handleRatingClear = async () => {
    setUserRating(null)
    await patch({ rating: undefined })
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

  const saveNote = async () => {
    if (!item) return
    setNoteSaving(true)
    try {
      await libraryService.setNote(item.id, noteEditText)
      setUserNote(noteEditText)
      setEditingNote(false)
    } finally {
      setNoteSaving(false)
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
      setSelectedLang('')
      if (item.status) await libraryService.setEdition(item.id, 0)
    } else {
      if (e.uuid) next.set('e', e.uuid)
      setEditionId(e.id)
      setSelectedLang(e.language ?? '')
      if (item.status) await libraryService.setEdition(item.id, e.id)
    }
    setParams(next, { replace: true })
  }

  if (loading) {
    return (
      <Layout>
        <DetailPageSkeleton />
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
  // null when the item isn't on the user's shelf yet, so the control shows
  // "Add to shelf" rather than a pre-selected status.
  const status = item.status ?? null
  const genres = Array.isArray(item.genre) ? item.genre : item.genre ? [item.genre] : []
  const displayRating = userRating !== null ? `${(userRating / 2).toFixed(1)}/5` : t('unrated')

  const totalCommPages = Math.max(1, Math.ceil(reviewsPage.total / COMM_PER_PAGE))
  const commPageItems = reviewsPage.items

  const goCommPage = (p: number) => {
    setCommPage(p)
    requestAnimationFrame(() => {
      const el = commSectionRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 88
      window.scrollTo({ top, behavior: 'smooth' })
    })
  }

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
  // Cover priority: the in-focus edition (when loaded), then the user's reading
  // edition's own cover (carried from signals, so it shows even before that
  // edition's carousel page loads), then the work's cover.
  const coverUrl = selectedEdition?.cover_url || readingEdition?.cover || item.coverUrl
  // Title priority mirrors the cover: the in-focus edition's own title (e.g. a
  // translated printing in another language), then the user's reading edition's
  // title, then the work's. So switching editions retitles the page.
  const displayTitle = selectedEdition?.title || readingEdition?.title || item.title
  // Page count to measure reading progress against: the selected edition's, when
  // it has one (the printing you're actually reading), else the work's.
  const totalPages = selectedEdition?.pages || readingEdition?.pages || item.pages || 0

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
        <div className="flex w-full flex-shrink-0 flex-col gap-3 md:w-64 md:sticky md:top-[88px] md:self-start">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {coverUrl ? (
              <img src={coverUrl} alt={displayTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--container-2)]">
                <Icon className="h-10 w-10 text-[var(--placeholder)]" />
              </div>
            )}
            <TypeBadge type={item.type} position="top-2.5 right-2.5" />
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
              <button
                onClick={() => setShareOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                <IoShareOutline className="h-4 w-4" />
              </button>
              {status !== null && (
                <button
                  onClick={() => { setNoteEditText(userNote); setEditingNote(true); document.getElementById('private-note-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}
                  title={t('privateNote') || 'Private note'}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
                >
                  <FiClipboard className="h-4 w-4" />
                </button>
              )}
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
            <div className="flex flex-col gap-3">
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
              {/* Editable reading/watching period — once the item is on the shelf.
                  Keyed on the loaded dates so it re-initialises when signals arrive. */}
              {status !== null && (
                <ReadingDates key={`${item.startedAt ?? ''}|${item.finishedAt ?? ''}`} item={item} onSaved={loadItem} />
              )}
              {/* Per-book reading-progress log (renders only once there's history). */}
              {status !== null && isBook && <ReadingProgress item={item} total={totalPages} refreshKey={progressRefresh} />}
              {/* Full interaction timeline — added/started/progress/finished/rated/
                  reviewed, for every media type (renders only once there's history). */}
              {status !== null && <MediaHistory item={item} refreshKey={progressRefresh} />}
            </div>
          ) : showSignIn ? (
            signInPrompt
          ) : null}
        </div>

        {/* ── Right: info ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
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
                {displayTitle}
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
              ) : item.makerUuid ? (
                // No per-role credits loaded, but the row carries its primary
                // maker's uuid (denormalized) — link the byline to their page.
                <Link to={`/p/${item.makerUuid}`} className="font-medium text-[var(--text)] hover:text-nonsprimary">
                  {isBook ? item.author : item.director || item.author}
                </Link>
              ) : (
                <span className="font-medium text-[var(--text)]">{isBook ? item.author : item.director || item.author}</span>
              )}
            </p>
          </div>

          <hr className="border-[var(--divider)]" />

          <div>
            <h3 className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('synopsis')}</h3>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              {selectedEdition?.description || item.description || t('noDescription')}
            </p>
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

              {/* Overall watch-progress bar — the series analogue of a book's
                  reading-progress bar (parallel "how far am I" affordance). */}
              {(() => {
                const pct = episodes.total > 0 ? Math.round((episodes.watched_count / episodes.total) * 100) : 0
                return (
                  <div className="mb-3">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium uppercase tracking-widest text-[var(--text-muted)]">{t('watchProgress')}</span>
                      <span className="font-semibold text-nonsprimary">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
                      <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                )
              })()}

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
            // More to load only matters in the unfiltered view (the ISBN find
            // searches the editions already loaded).
            const hasMore = !find && editions.length < editionsTotal
            return (
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    {t('editions') || 'Editions'} ({editionsTotal})
                  </h3>
                  <input
                    value={isbnFind}
                    onChange={(e) => setIsbnFind(e.target.value)}
                    placeholder={t('findByIsbn')}
                    className="h-8 w-40 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  />
                </div>
                <p className="mb-2 text-xs text-[var(--text-muted)]">{t('selectEditionHint')}</p>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Scroll left"
                    onClick={() => scrollEditions(-1)}
                    className="absolute -left-3 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
                  >
                    <IoChevronBack className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Scroll right"
                    onClick={() => scrollEditions(1)}
                    className="absolute -right-3 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--container)] text-[var(--text)] shadow-md transition-colors hover:bg-[var(--surface-hover)] sm:flex"
                  >
                    <IoChevronForward className="h-5 w-5" />
                  </button>
                  <div ref={editionsRef} className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
                  {shown.map((e) => {
                    const selected = selectedEdition?.id === e.id
                    return (
                      <div
                        key={e.id}
                        className={`flex w-40 flex-shrink-0 flex-col overflow-hidden rounded-xl border transition-colors ${
                          selected ? 'border-nonsprimary bg-[var(--primary-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface)]'
                        }`}
                      >
                        <button onClick={() => chooseEdition(e)} className="block" title={e.title || item.title}>
                          <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden bg-[var(--container-2)]">
                            {/* Fall back to the work cover so an edition without its own
                                cover still shows one instead of a blank box. */}
                            {(e.cover_url || item.coverUrl) ? (
                              <img src={e.cover_url || item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <Icon className="h-8 w-8 text-[var(--placeholder)]" />
                            )}
                          </div>
                        </button>
                        <div className="flex flex-1 flex-col p-2.5">
                          <p className="truncate text-sm text-[var(--text)]">{e.title || item.title}</p>
                          <p className="mt-0.5 min-h-[1rem] truncate text-xs text-[var(--text-muted)]">
                            {[
                              e.publisher,
                              e.published_year || undefined,
                              (e.language || '').toUpperCase() || undefined,
                              e.pages ? t('pagesCount', { count: e.pages }) : undefined,
                            ]
                              .filter(Boolean)
                              .join(' · ') || ' '}
                          </p>
                          <p className="mt-0.5 min-h-[0.95rem] truncate text-[11px] text-[var(--text-muted)]">
                            {e.isbn13 || e.isbn10 ? `ISBN ${e.isbn13 || e.isbn10}` : ' '}
                          </p>
                          <button
                            onClick={() => chooseEdition(e)}
                            className={`mt-2.5 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              selected
                                ? 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                                : 'border border-nonsprimary/40 text-nonsprimaryfocus hover:bg-[var(--primary-soft)]'
                            }`}
                          >
                            {selected ? (
                              <>
                                <IoCheckmarkCircle className="h-4 w-4" />
                                {t('selectedEdition') || 'Selected'}
                              </>
                            ) : (
                              <>
                                <IoCheckmarkCircleOutline className="h-4 w-4" />
                                {t('selectThisEdition') || 'Select this'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                    {hasMore && (
                      <div className="flex w-40 flex-shrink-0 items-center justify-center">
                        <button
                          type="button"
                          onClick={loadMoreEditions}
                          disabled={editionsLoadingMore}
                          className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
                        >
                          <IoChevronForward className="h-5 w-5" />
                          {editionsLoadingMore ? (t('loading') || 'Loading…') : (t('loadMore') || 'Load more')}
                        </button>
                      </div>
                    )}
                    {shown.length === 0 && <p className="text-xs text-[var(--text-muted)]">{t('noResults')}</p>}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── My review ── */}
          {canInteract && (
            <div className="flex flex-col gap-5">
              <div className="-mx-4 md:mx-0 rounded-none md:rounded-2xl border-y md:border border-[var(--border-subtle)] bg-[var(--surface)] p-0 md:p-5">
                <div className="px-4 py-4 md:p-0">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('yourReview')}</h3>
                  </div>

                  <StarsSelector initialValue={userRating} onChange={handleRatingChange} onClear={handleRatingClear} isEditable />

                  {editingReview ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={userReview}
                        onChange={(e) => { setUserReview(e.target.value); setReviewSaved(false) }}
                        rows={4}
                        autoFocus
                        placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
                        className="w-full resize-none rounded-md border-0 bg-black/[.04] dark:bg-white/[.04] px-2 py-1 text-sm leading-7 text-[var(--text-muted)] placeholder:text-[var(--placeholder)] focus:outline-none focus:bg-black/[.07] dark:focus:bg-white/[.07] transition-colors"
                      />
                      <div className="flex items-center justify-end gap-3">
                        {reviewSaved && <span className="text-xs text-[var(--text-muted)]">{t('saved') || 'Saved'}</span>}
                        <button
                          onClick={() => { setUserReview(item.review ?? ''); setEditingReview(false) }}
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
                  ) : userReview ? (
                    <p
                      onClick={() => setEditingReview(true)}
                      className="mt-3 cursor-text text-sm leading-7 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {userReview}
                    </p>
                  ) : (
                    <p
                      onClick={() => setEditingReview(true)}
                      className="mt-3 cursor-text text-sm italic text-[var(--placeholder)] hover:text-[var(--text-muted)] transition-colors"
                    >
                      {t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Private note ── */}
              {status !== null && (
                <div id="private-note-section" className="group relative -mx-4 md:mx-0 rounded-none md:rounded-2xl border-y md:border border-[var(--border-subtle)] bg-[var(--surface)] p-0 md:p-5">
                  <div className="px-4 py-4 md:p-0">
                    <div className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      <FiClipboard className="h-3.5 w-3.5" />
                      {t('privateNote')}
                    </div>

                    {editingNote ? (
                      <div className="flex flex-col gap-3">
                        <textarea
                          autoFocus
                          value={noteEditText}
                          onChange={(e) => setNoteEditText(e.target.value)}
                          rows={4}
                          placeholder={t('privateNotePlaceholder')}
                          className="w-full resize-none rounded-md border-0 bg-black/[.04] dark:bg-white/[.04] px-2 py-1 text-sm leading-7 text-[var(--text-muted)] placeholder:text-[var(--placeholder)] focus:outline-none focus:bg-black/[.07] dark:focus:bg-white/[.07] transition-colors"
                        />
                        <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <IoLockClosedOutline className="h-3 w-3 flex-shrink-0" />
                          {t('onlyVisibleToYou')}
                        </p>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setEditingNote(false)}
                            className="rounded-lg border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            onClick={saveNote}
                            disabled={noteSaving || noteEditText === userNote}
                            className="rounded-lg bg-nonsprimary px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            {noteSaving ? t('saving') : t('save')}
                          </button>
                        </div>
                      </div>
                    ) : userNote ? (
                      <>
                        <p onClick={() => { setNoteEditText(userNote); setEditingNote(true) }} className="cursor-text pr-7 text-sm leading-7 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">{userNote}</p>
                        <button
                          onClick={() => { setNoteEditText(userNote); setEditingNote(true) }}
                          className="absolute right-3 top-3 md:right-5 md:top-5 rounded-lg p-1 text-[var(--text-muted)] transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--text)]"
                        >
                          <IoPencilOutline className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <p
                        onClick={() => { setNoteEditText(''); setEditingNote(true) }}
                        className="cursor-text text-sm italic text-[var(--placeholder)] hover:text-[var(--text-muted)] transition-colors"
                      >
                        {t('addPrivateNote')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Friends rating ── */}
              <div className="-mx-4 md:mx-0 rounded-none md:rounded-2xl border-y md:border border-[var(--border-subtle)] bg-[var(--surface)] p-0 md:p-5">
                <div className="px-4 py-4 md:p-0">
                  <h3 className="mb-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Friends</h3>
                  {!friendsLoaded ? (
                    <p className="text-sm text-[var(--placeholder)]">{t('loading')}</p>
                  ) : friendReviews.length === 0 ? (
                    <p className="text-sm text-[var(--placeholder)]">No friends have rated this yet.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                      {friendReviews.map((r) => {
                        const u = friendUsers.get(r.userId)
                        const f = {
                          handle: r.username ?? `user-${r.userId}`,
                          name: r.name || r.username || 'Friend',
                          rating: r.value,
                          color: u?.color ?? colorFor(r.username ?? ''),
                          review: r.review ?? null,
                        }
                        return <FriendRatingRow key={r.userId} f={f} />
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Community rating ── */}
              <div ref={commSectionRef} style={{ scrollMarginTop: 88 }} className="-mx-4 md:mx-0 rounded-none md:rounded-2xl border-y md:border border-[var(--border-subtle)] bg-[var(--surface)] p-0 md:p-5">
              <div className="px-4 py-4 md:p-0">
                {/* title + avg side by side; avg floats right below the title */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Community</h3>
                    {/* sort chips + checkbox */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['newest', 'oldest', 'high', 'low'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => { setCommSort(s); setCommPage(0) }}
                          className={`rounded-full px-3 py-1 text-xs transition-colors ${
                            commSort === s
                              ? 'bg-[var(--primary-soft)] text-nonsprimary'
                              : 'border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
                          }`}
                        >
                          {s === 'newest' ? 'Newest' : s === 'oldest' ? 'Oldest' : s === 'high' ? 'High ★' : 'Low ★'}
                        </button>
                      ))}
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={commWithReview}
                          onChange={(e) => { setCommWithReview(e.target.checked); setCommPage(0) }}
                          className="h-3.5 w-3.5 rounded accent-nonsprimary"
                        />
                        With a review
                      </label>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-3xl font-bold leading-none text-[var(--text)]">
                      {reviewsPage.count > 0 ? (reviewsPage.average / 2).toFixed(1) : '—'}
                    </span>
                    <div className="mt-1 flex justify-end">
                      <StarsSelector initialValue={reviewsPage.average} isEditable={false} size="sm" />
                    </div>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t('ratingsCountLabel', { n: reviewsPage.count.toLocaleString() })}</span>
                  </div>
                </div>

                {reviewsLoading && commPageItems.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--text-muted)]">{t('loading')}</p>
                ) : reviewsPage.total === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--placeholder)]">
                    {commWithReview ? 'No written reviews yet.' : 'No ratings yet.'}
                  </p>
                ) : (
                  <>
                    {/* top pagination */}
                    {totalCommPages > 1 && (
                      <div className="mb-4 flex items-center justify-center gap-1.5">
                        <button onClick={() => goCommPage(commPage - 1)} disabled={commPage === 0} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <div className="relative flex h-9 w-9 -rotate-1 items-center justify-center rounded-br-lg rounded-tl-lg border border-[var(--border)] bg-[var(--container)] text-sm font-medium text-[var(--text)] shadow-md">
                          <span className="rotate-1">{commPage + 1}</span>
                        </div>
                        <button onClick={() => goCommPage(commPage + 1)} disabled={commPage >= totalCommPages - 1} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                    )}

                    {/* reviews list */}
                    <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                      {commPageItems.map((r) => {
                        const display = r.name || r.username || 'User'
                        return (
                          <div key={r.userId} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-3">
                              {r.avatarUrl ? (
                                <img src={r.avatarUrl} alt="" loading="lazy" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                              ) : (
                                <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 28, height: 28 }}>
                                  <BoringAvatar size={28} name={`user-${r.userId}`} />
                                </span>
                              )}
                              {r.username ? (
                                <Link to={userPath(r.username)} className="min-w-0 flex-1 truncate text-sm text-[var(--text)] hover:text-nonsprimary">{display}</Link>
                              ) : (
                                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{display}</span>
                              )}
                              {r.value > 0 && <StarsSelector initialValue={r.value} isEditable={false} size="sm" />}
                              <span className="text-xs text-[var(--text-muted)]">{reviewDate(r.updatedAt)}</span>
                            </div>
                            {r.review && <p className="mt-2 pl-10 text-xs leading-6 text-[var(--text-muted)]">{r.review}</p>}
                          </div>
                        )
                      })}
                    </div>

                    {/* bottom pagination */}
                    {totalCommPages > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-1.5">
                        <button onClick={() => goCommPage(commPage - 1)} disabled={commPage === 0} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <div className="relative flex h-9 w-9 -rotate-1 items-center justify-center rounded-br-lg rounded-tl-lg border border-[var(--border)] bg-[var(--container)] text-sm font-medium text-[var(--text)] shadow-md">
                          <span className="rotate-1">{commPage + 1}</span>
                        </div>
                        <button onClick={() => goCommPage(commPage + 1)} disabled={commPage >= totalCommPages - 1} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {item && (
        <ShareModal
          isOpen={shareOpen}
          item={item}
          coverUrl={coverUrl}
          totalPages={totalPages}
          rating={userRating}
          review={userReview}
          status={status}
          onClose={() => setShareOpen(false)}
        />
      )}

      <ProgressModal
        isOpen={progressOpen}
        item={item}
        total={totalPages}
        onClose={() => { setProgressOpen(false); setProgressRefresh((n) => n + 1) }}
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
        <StarsSelector initialValue={f.rating} isEditable={false} size="sm" />
      </div>
      {f.review && (
        <p className="mt-2 pl-10 text-xs leading-6 text-[var(--text-muted)]">{f.review}</p>
      )}
    </div>
  )
}
