import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoChevronDown, IoCheckmarkDoneOutline, IoInformationCircle, IoTvOutline } from 'react-icons/io5'
import { authedFetch } from '../lib/api'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  onClose: () => void
  // Called when the user hits "Finished" — the parent swaps in the ending modal.
  onFinish: () => void
}

// Series episodes from GET /api/media/:id/episodes (grouped by season).
interface Episode {
  id: number
  season: number
  number: number
  title?: string
  overview?: string
  air_date?: string
  still_url?: string
}
interface EpisodesResponse {
  seasons: { season: number; episodes: Episode[] }[]
  watched: Record<string, number>
  watched_count: number
  total: number
}

// "Update progress" modal: where am I in this book/series? Books track the
// current page; series tick off watched episodes. The "Finished" button hands
// off to the ending (rate/review/dates) modal.
export default function ProgressModal({ isOpen, item, onClose, onFinish }: Props) {
  const { t } = useLanguage()
  const isBook = item?.type === 'book'

  const [page, setPage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [episodes, setEpisodes] = useState<EpisodesResponse | null>(null)
  // Explicit expand/collapse per season; unset seasons default to collapsed when
  // fully watched (so a 15-season show isn't an endless wall of episodes).
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({})
  // The episode whose info card is showing, anchored to the clicked corner button
  // (rendered via a portal so it isn't clipped by the scrollable season list).
  const [info, setInfo] = useState<{ ep: Episode; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!isOpen || !item) return
    setPage('')
    setSaved(false)
    setEpisodes(null)
    setOpenSeasons({})
    setInfo(null)
    if (item.type !== 'series') return
    let cancelled = false
    authedFetch(`/api/media/${item.id}/episodes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setEpisodes(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  const total = item.pages || 0

  const savePage = async () => {
    const p = parseInt(page, 10)
    if (!p || p < 0) return
    setSaving(true)
    setSaved(false)
    try {
      const pct = total > 0 ? Math.min(100, Math.round((p / total) * 100)) : 0
      await libraryService.logProgress(item.id, { page: p, pct })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  // Open/move the episode info card to the clicked corner button (toggles off if
  // the same episode is clicked again).
  const showInfo = (e: React.MouseEvent, ep: Episode) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setInfo((cur) => (cur?.ep.id === ep.id ? null : { ep, x: r.right, y: r.bottom }))
  }

  const toggleEpisode = async (episodeId: number, watched: boolean) => {
    setEpisodes((prev) => {
      if (!prev) return prev
      const next = { ...prev.watched }
      if (watched) next[episodeId] = Math.floor(Date.now() / 1000)
      else delete next[episodeId]
      return { ...prev, watched: next, watched_count: Object.keys(next).length }
    })
    await libraryService.setEpisodeWatched(episodeId, watched)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] px-4 pb-28 pt-4 sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">
              {t('updateProgress')}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{item.title}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* Book: current page + its own "Update progress" button */}
        {isBook && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
            <label className="text-sm font-medium text-[var(--text)]">{t('currentPage')}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={total || undefined}
                value={page}
                onChange={(e) => {
                  setPage(e.target.value)
                  setSaved(false)
                }}
                placeholder={total ? `0 – ${total}` : t('page')}
                className="h-11 w-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
              {total > 0 && <span className="text-sm text-[var(--text-muted)]">/ {total}</span>}
            </div>
            <button
              onClick={savePage}
              disabled={saving || !page}
              className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t('saving') : saved ? t('saved') : t('updateProgress')}
            </button>
          </div>
        )}

        {/* Series: tick off watched episodes */}
        {!isBook && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {episodes && episodes.total > 0 ? (
              <>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('watchedOfTotal', { watched: episodes.watched_count, total: episodes.total })}
                </p>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                  {episodes.seasons.map((s) => {
                    const seen = s.episodes.filter((ep) => episodes.watched[ep.id]).length
                    const full = s.episodes.length > 0 && seen === s.episodes.length
                    const open = openSeasons[s.season] ?? !full
                    return (
                      <div key={s.season} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                        <button
                          onClick={() => setOpenSeasons((prev) => ({ ...prev, [s.season]: !open }))}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                            <IoChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                            {t('season')} {s.season}
                          </span>
                          <span className={`text-xs font-medium ${full ? 'text-nonsprimary' : 'text-[var(--text-muted)]'}`}>
                            {seen}/{s.episodes.length}
                            {full ? ' ✓' : ''}
                          </span>
                        </button>
                        {open && (
                          <div className="grid grid-cols-5 gap-2.5 px-3 pb-3 sm:grid-cols-8">
                            {s.episodes.map((ep) => {
                              const watched = !!episodes.watched[ep.id]
                              return (
                                <div key={ep.id} className="group relative">
                                  <button
                                    onClick={() => toggleEpisode(ep.id, !watched)}
                                    title={ep.title || `S${ep.season}E${ep.number}`}
                                    className={`flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                                      watched
                                        ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary'
                                        : 'border-[var(--border-subtle)] bg-[var(--input)] text-[var(--text-muted)] hover:border-nonsprimary hover:text-[var(--text)]'
                                    }`}
                                  >
                                    {ep.number}
                                  </button>
                                  {/* corner info button — always shown on touch, hover-revealed on
                                      desktop; tap/click opens the info card. */}
                                  <button
                                    onClick={(e) => showInfo(e, ep)}
                                    title={t('episodeInfo')}
                                    className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--container)] text-[var(--text-muted)] shadow transition-opacity hover:text-nonsprimary ${
                                      info?.ep.id === ep.id
                                        ? 'text-nonsprimary opacity-100'
                                        : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                                    }`}
                                  >
                                    <IoInformationCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[var(--text-muted)]">
                <IoTvOutline className="h-6 w-6 text-[var(--placeholder)]" />
                {episodes ? t('noEpisodes') : t('loading')}
              </div>
            )}
          </div>
        )}

        {/* The "done with it" action — kept visually separate and prominent so it
            isn't mistaken for the update-progress button above. */}
        <div className="mt-1 flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
          <p className="text-xs text-[var(--text-muted)]">
            {isBook ? t('finishedReadingHint') : t('finishedWatchingHint')}
          </p>
          <button
            onClick={onFinish}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-nonsprimary bg-[var(--primary-soft)] text-sm font-semibold text-nonsprimary transition-opacity hover:opacity-80"
          >
            <IoCheckmarkDoneOutline className="h-5 w-5" />
            {t('imFinished')}
          </button>
        </div>
      </div>

      {/* Episode info card, portalled to the body so the scrollable season list
          can't clip it. Anchored to the clicked corner button, clamped to view.
          A transparent backdrop dismisses it on a tap/click anywhere. */}
      {info &&
        createPortal(
          <>
            <div
              onClick={(e) => {
                // Portal events bubble through the React tree (into the modal's
                // onClose) — stop here so dismissing the card doesn't close the modal.
                e.stopPropagation()
                setInfo(null)
              }}
              style={{ position: 'fixed', inset: 0, zIndex: 89 }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: Math.min(info.x - 8, window.innerWidth - 232),
                top: Math.min(info.y + 6, window.innerHeight - 200),
                width: 224,
                zIndex: 90,
              }}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--container)] shadow-xl"
            >
            {info.ep.still_url ? (
              <img src={info.ep.still_url} alt="" className="aspect-video w-full object-cover" />
            ) : null}
            <div className="p-2.5">
              <p className="text-sm font-semibold leading-snug text-[var(--text)]">
                {info.ep.title || `S${info.ep.season}E${info.ep.number}`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                S{info.ep.season} · E{info.ep.number}
                {info.ep.air_date ? ` · ${info.ep.air_date}` : ''}
              </p>
              {info.ep.overview ? (
                <p className="mt-1.5 line-clamp-4 text-xs leading-5 text-[var(--text-muted)]">{info.ep.overview}</p>
              ) : null}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
