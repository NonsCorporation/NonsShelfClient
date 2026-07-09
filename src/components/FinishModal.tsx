'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoChevronDown } from 'react-icons/io5'
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import { tagService } from '../services/tagService'
import type { MediaItem, TagTaxonomyFacet, TagTaxonomyGroup } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import DatePicker from './DatePicker'
import NonsPostPreview from './NonsPostPreview'

type Props = {
  isOpen: boolean
  item: MediaItem | null
  onClose: () => void
  onFinished: () => void
}

// A unix-seconds / ISO value → "YYYY-MM-DD" for <input type="date">.
function toDateInput(v?: string | number): string {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

// The Goodreads-style "ending" modal: rate, review, set the dates and post.
export default function FinishModal({ isOpen, item, onClose, onFinished }: Props) {
  const { t } = useLanguage()
  const [rating, setRating] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [started, setStarted] = useState('')
  const [finished, setFinished] = useState(today())
  const [share, setShare] = useState(true)
  // Independent of `share` above: `share` controls the library's own internal
  // activity feed, this controls whether a real post is also created on the
  // main nons feed. Defaults off since it's a bigger, public-facing action.
  const [postToNons, setPostToNons] = useState(false)
  const [nonsTitle, setNonsTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [nonsError, setNonsError] = useState<string | null>(null)

  // Community tags (StoryGraph-style: pacing/mood/genre/content warnings/…).
  // Collapsed by default — the taxonomy is large — but pre-loaded with the
  // taxonomy and the user's previous picks so opening it shows the full picker.
  const [taxonomy, setTaxonomy] = useState<TagTaxonomyGroup[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set())
  const [tagsOpen, setTagsOpen] = useState(false)

  // Pull the user's current rating/review + the started date when opening.
  useEffect(() => {
    if (!isOpen || !item) return
    setRating(item.rating ?? null)
    setReview('')
    setStarted(toDateInput(item.startedAt ?? item.dateAdded))
    setFinished(toDateInput(item.finishedAt) || today())
    setPostToNons(false)
    setNonsTitle(item.title)
    setNonsError(null)
    setTagsOpen(false)
    setSelectedTags(new Set())
    let cancelled = false
    libraryService.getItem(item.id).then((full) => {
      if (cancelled || !full) return
      setRating(full.rating ?? null)
      setReview(full.review ?? '')
      setStarted(toDateInput(full.startedAt ?? full.dateAdded))
      if (full.finishedAt) setFinished(toDateInput(full.finishedAt))
    })
    tagService.getTaxonomy().then((groups) => { if (!cancelled) setTaxonomy(groups) })
    tagService.getMyVotes(item.id).then((ids) => { if (!cancelled) setSelectedTags(new Set(ids)) })
    return () => {
      cancelled = true
    }
  }, [isOpen, item])

  // Multi-select facets (mood, genre, …) toggle freely; single-select facets
  // (pacing, audience, …) clear any other pick in the same facet first, so at
  // most one of their tags is ever selected — clicking the current pick again clears it.
  const toggleTag = (facet: TagTaxonomyFacet, tagId: number) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (facet.multi) {
        if (next.has(tagId)) next.delete(tagId)
        else next.add(tagId)
        return next
      }
      const wasSelected = prev.has(tagId)
      for (const t of facet.tags) next.delete(t.id)
      if (!wasSelected) next.add(tagId)
      return next
    })
  }

  if (!isOpen || !item) return null

  const isBook = item.type === 'book'
  const finishedLabel = isBook ? t('dateRead') || 'Date read' : t('dateWatched') || 'Date watched'

  const post = async () => {
    setBusy(true)
    setNonsError(null)
    try {
      const finishedAt = finished ? Math.floor(new Date(finished).getTime() / 1000) : undefined
      await libraryService.finish(item.id, { rating, review, finishedAt, share })
      // Persist the chosen started/finished dates as the authoritative reading
      // period (so they match what shows on the media page and the calendar).
      await libraryService.setReadDates(item.id, {
        started_at: started ? Math.floor(new Date(started).getTime() / 1000) : 0,
        finished_at: finishedAt ?? 0,
      })
      // Best-effort, like the cross-post below — a tag-save hiccup shouldn't
      // block finishing the book.
      try {
        await tagService.setMyVotes(item.id, [...selectedTags])
      } catch {
        /* non-critical */
      }
      // Cross-posting to the main nons feed is a separate service/action from
      // the above — best-effort, so a nons-server hiccup never blocks finishing
      // the book. On failure we still close out via onFinished() below.
      if (postToNons) {
        try {
          await libraryService.postToNons(item, { title: nonsTitle || item.title, content: review })
        } catch {
          setNonsError(t('postToNonsFailed') || 'Could not post to Nons. Your book was still finished.')
        }
      }
      onFinished()
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className="h-16 w-11 flex-shrink-0 rounded object-cover" />
            ) : (
              <div className="h-16 w-11 flex-shrink-0 rounded bg-[var(--container-2)]" />
            )}
            <div>
              <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--text)]">{item.title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{item.author}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--text)]">{t('rating') || 'Rating'}</span>
          <StarsSelector initialValue={rating} onChange={setRating} onClear={() => setRating(null)} isEditable />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('yourReview') || 'Review'}
          <textarea
            rows={4}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        {/* Community tags (StoryGraph-style): pacing/mood/genre/setting/content
            warnings/… — collapsed by default since the full taxonomy is large. */}
        {taxonomy.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-subtle)] p-3">
            <button
              type="button"
              onClick={() => setTagsOpen((v) => !v)}
              className="flex items-center justify-between text-sm font-medium text-[var(--text)]"
            >
              <span>
                {t('tags') || 'Tags'}
                {selectedTags.size > 0 && <span className="text-[var(--text-muted)]"> ({selectedTags.size})</span>}
              </span>
              <IoChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${tagsOpen ? 'rotate-180' : ''}`} />
            </button>
            {tagsOpen && (
              <div className="mt-2 flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
                {taxonomy.map((group) => (
                  <div key={group.key}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.facets.map((facet) => (
                        <div key={facet.key}>
                          <p
                            className="mb-1 inline-block text-[11px] font-medium underline decoration-2 underline-offset-4"
                            style={{ color: facet.color, textDecorationColor: facet.color }}
                          >
                            {facet.label}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {facet.tags.map((tag) => {
                              const selected = selectedTags.has(tag.id)
                              return (
                                <button
                                  type="button"
                                  key={tag.id}
                                  onClick={() => toggleTag(facet, tag.id)}
                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                    selected
                                      ? 'border-transparent bg-[var(--surface-active)] text-[var(--text)]'
                                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {t('dateStarted') || 'Date started'}
            </p>
            <DatePicker
              value={started}
              onChange={setStarted}
              max={finished || undefined}
              placeholder="—"
              openUp={true}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {finishedLabel}
            </p>
            <DatePicker
              value={finished}
              onChange={setFinished}
              min={started || undefined}
              placeholder="—"
              openUp={true}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-subtle)]"
          />
          {t('shareToFeed')}
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={postToNons}
            onChange={(e) => setPostToNons(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-subtle)]"
          />
          {t('postToNons') || 'Post to Nons'}
        </label>

        {postToNons && (
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('nonsPostTitle') || 'Post title'}
              <input
                type="text"
                value={nonsTitle}
                onChange={(e) => setNonsTitle(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </label>
            <NonsPostPreview item={item} title={nonsTitle} review={review} rating={rating} />
          </div>
        )}

        {nonsError && <p className="text-sm text-red-500">{nonsError}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={post}
            disabled={busy}
            className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {busy ? t('saving') || 'Saving…' : t('post') || 'Post'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
