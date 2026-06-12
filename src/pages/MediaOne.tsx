import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import StarsSelector from '../StarsSelector'
import { libraryService } from '../services/libraryService'
import type { MediaItem, ShelfStatus } from '../types'
import {
  IoFilmOutline,
  IoBookOutline,
  IoTimeOutline,
  IoHeart,
  IoHeartOutline,
  IoShareOutline,
  IoArrowBack,
} from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { STATUS_ORDER, STATUS_COLOR, statusLabel } from '../lib/shelf'

export default function MediaOnePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<MediaItem | null>(null)
  const [loading, setLoading] = useState(true)

  const [userRating, setUserRating] = useState<number | null>(null)
  const [userReview, setUserReview] = useState('')

  useEffect(() => {
    if (!id) return
    libraryService.getItem(id).then((found) => {
      if (found) {
        setItem(found)
        setUserRating(found.rating ?? null)
      }
      setLoading(false)
    })
  }, [id])

  const patch = async (updates: Partial<MediaItem>) => {
    if (!id) return
    const updated = await libraryService.updateItem(id, updates)
    setItem(updated)
  }

  const handleRatingChange = async (val: number) => {
    setUserRating(val)
    await patch({ rating: val })
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
  const Icon = isBook ? IoBookOutline : IoFilmOutline
  const status = item.status ?? 'wishlist'
  const genres = Array.isArray(item.genre) ? item.genre : item.genre ? [item.genre] : []
  const displayRating = userRating !== null ? `${(userRating / 2).toFixed(1)}/5` : t('unrated')

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
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--container-2)]">
                <Icon className="h-10 w-10 text-[var(--placeholder)]" />
              </div>
            )}
          </div>

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
          </div>

          {/* Status shelf control */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('status')}</p>
            <div className="flex flex-col gap-1">
              {STATUS_ORDER.map((s: ShelfStatus) => (
                <button
                  key={s}
                  onClick={() => patch({ status: s })}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    status === s
                      ? 'bg-[var(--surface-active)] font-medium text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                  {statusLabel(item.type, s, t)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: info ── */}
        <div className="flex flex-1 flex-col gap-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-[var(--text-muted)]">
              <Icon className="h-3.5 w-3.5" />
              <span>{isBook ? t('book') : t('film')}</span>
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
              <span className="font-medium text-[var(--text)]">{isBook ? item.author : item.director || item.author}</span>
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

          {!isBook && item.actors && item.actors.length > 0 && (
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

          {/* Rating & review */}
          <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('yourReview')}</h3>
              <span className="text-sm font-medium text-[var(--text)]">{displayRating}</span>
            </div>
            <StarsSelector initialValue={userRating} onChange={handleRatingChange} isEditable />
            <textarea
              value={userReview}
              onChange={(e) => setUserReview(e.target.value)}
              rows={2}
              placeholder={t('reviewPlaceholder', { type: isBook ? t('book').toLowerCase() : t('film').toLowerCase() })}
              className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
