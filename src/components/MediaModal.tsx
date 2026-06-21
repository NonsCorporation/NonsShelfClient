import { useState, useEffect } from 'react'
import { IoClose, IoBookOutline, IoFilmOutline, IoTvOutline, IoSearch, IoGitMergeOutline } from 'react-icons/io5'
import { useNavigate } from '@/lib/router'
import type { MediaItem, MediaType, ShelfStatus } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'
import { STATUS_ORDER, STATUS_COLOR, statusLabel } from '../lib/shelf'
import { mediaPath } from '../lib/paths'
import EditionsManager from './EditionsManager'
import EpisodesManager from './EpisodesManager'
import CreditsManager from './CreditsManager'
import PersonPicker from './PersonPicker'
import { librarianService } from '../services/librarianService'
import { catalogService } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'

type MediaModalProps = {
  isOpen: boolean
  initialData?: Partial<MediaItem> & { id?: string }
  initialType?: 'book' | 'movie'
  // catalogOnly hides the shelf-status control: the librarian is curating the
  // shared catalog, not adding the item to their own shelf.
  catalogOnly?: boolean
  // withEditions shows the editions manager when editing an existing book.
  withEditions?: boolean
  onClose: () => void
  onSave: (data: Partial<MediaItem>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function MediaModal({ isOpen, initialData, initialType, catalogOnly, withEditions, onClose, onSave, onDelete }: MediaModalProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  // Decide if we are editing or creating
  const isEditing = !!initialData?.id
  // Series rows aren't created from this form (they're seeded), but an existing
  // one can be edited here — so the state holds the full MediaType and anything
  // non-book uses the film-style fields.
  const [type, setType] = useState<MediaType>(initialData?.type || initialType || 'book')
  const [status, setStatus] = useState<ShelfStatus>(initialData?.status || 'wishlist')

  const [form, setForm] = useState({
    title: '',
    originalTitle: '',
    author: '',
    director: '',
    coverUrl: '',
    year: '',
    duration: '',
    description: '',
    genre: '',
  })

  useEffect(() => {
    if (isOpen) {
      setType(initialData?.type || initialType || 'book')
      setStatus(initialData?.status || 'wishlist')

      const genre = Array.isArray(initialData?.genre) ? initialData.genre.join(', ') : initialData?.genre || ''

      setForm({
        title: initialData?.title || '',
        originalTitle: initialData?.titleEn || '',
        author: initialData?.author || '',
        director: initialData?.director || '',
        coverUrl: initialData?.coverUrl || '',
        year: initialData?.year?.toString() || '',
        duration: initialData?.duration || '',
        description: initialData?.description || '',
        genre,
      })
    }
  }, [isOpen, initialData, initialType])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!form.title) return

    const baseData: Partial<MediaItem> = {
      type,
      status,
      title: form.title,
      titleEn: form.originalTitle.trim() || undefined,
      author: form.author,
      coverUrl: form.coverUrl || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      description: form.description || undefined,
      genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : undefined,
    }

    if (type !== 'book') {
      baseData.director = form.director || form.author
      baseData.duration = form.duration || undefined
    }

    await onSave(baseData)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-[var(--overlay)] flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--container)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)] flex-shrink-0 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">
              {isEditing ? t('editDetails') : t('addNewEntry')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 tracking-wide">
              {isEditing ? t('updateInfo', { type: (type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')).toLowerCase() }) : t('chooseTypeDesc')}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-colors">
            <IoClose className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {!isEditing && (
          <div className="px-5 pt-4 flex-shrink-0">
            <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
              <button
                onClick={() => setType('book')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'book' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoBookOutline className="w-4 h-4" />
                {t('book')}
              </button>
              <button
                onClick={() => setType('movie')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'movie' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoFilmOutline className="w-4 h-4" />
                {t('movie')}
              </button>
              <button
                onClick={() => setType('series')}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${type === 'series' ? 'bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}
              >
                <IoTvOutline className="w-4 h-4" />
                {t('series')}
              </button>
            </div>
          </div>
        )}

        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          {!catalogOnly && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--text)]">{t('status')}</span>
              <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      status === s ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                    {statusLabel(type, s, t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('title')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('title')} value={form.title} onChange={(e) => setForm(s => ({...s, title: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('originalTitle')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('originalTitle')} value={form.originalTitle} onChange={(e) => setForm(s => ({...s, originalTitle: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {type === 'book' ? t('author') : t('director')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={type === 'book' ? t('author') : t('director')} value={type === 'book' ? form.author : form.director} onChange={(e) => setForm(s => type === 'book' ? ({...s, author: e.target.value}) : ({...s, director: e.target.value}))} />
          </label>

          {/* Link the author/director to a person entity (searchable + creatable). */}
          {withEditions && isEditing && initialData?.id && (
            <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {type === 'book' ? t('linkAuthor') : t('linkDirector')}
              <PersonPicker
                current={{ uuid: initialData.makerUuid, name: type === 'book' ? form.author : form.director }}
                onPick={async (p) => {
                  setForm((s) => (type === 'book' ? { ...s, author: p.name } : { ...s, director: p.name }))
                  await librarianService.setMaker(initialData.id!, p.uuid, type === 'book' ? 'author' : 'director').catch(() => {})
                }}
              />
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('coverUrl')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('coverUrl')} value={form.coverUrl} onChange={(e) => setForm(s => ({...s, coverUrl: e.target.value}))} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('firstPublished') || t('year')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('year')} value={form.year} onChange={(e) => setForm(s => ({...s, year: e.target.value}))} />
            </label>

            {type !== 'book' && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
                {t('duration')}
                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('durationPlaceholder')} value={form.duration} onChange={(e) => setForm(s => ({...s, duration: e.target.value}))} />
              </label>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('genrePlaceholder')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('genrePlaceholder')} value={form.genre} onChange={(e) => setForm(s => ({...s, genre: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('synopsis')}
            <textarea rows={4} className="p-3 resize-none rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('synopsis')} value={form.description} onChange={(e) => setForm(s => ({...s, description: e.target.value}))} />
          </label>

          {/* Cast & crew — credits in roles (actors, producers, translators, …). */}
          {withEditions && isEditing && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('castAndCrew')}</span>
              <CreditsManager mediaId={initialData.id} mediaType={type} />
            </div>
          )}

          {/* Editions manager — only when editing an existing book. */}
          {withEditions && isEditing && type === 'book' && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('editionsTitle')}</span>
              <EditionsManager mediaId={initialData.id} fallbackTitle={form.title} />
            </div>
          )}

          {/* Episodes manager — only when editing an existing series. */}
          {withEditions && isEditing && type === 'series' && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('episodesTitle')}</span>
              <EpisodesManager mediaId={initialData.id} />
            </div>
          )}

          {/* Merge THIS entry into another one (this entry disappears). Books and
              movies only — series merge would leave episodes/watches orphaned. */}
          {withEditions && isEditing && initialData?.id && type !== 'series' && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('mergeIntoTitle')}</span>
              <p className="text-xs text-[var(--text-muted)]">{t('mergeIntoHint')}</p>
              <MergeIntoSection
                mediaId={initialData.id}
                type={type}
                fallbackTitle={form.title}
                onMerged={(keep) => {
                  onClose()
                  navigate(mediaPath({ type: keep.type, uuid: keep.uuid, id: keep.id }))
                }}
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--divider)] bg-[var(--surface)] flex justify-end gap-3 flex-shrink-0">
          {isEditing && onDelete && (
            <button onClick={() => initialData.id && onDelete(initialData.id)} className="px-4 h-10 rounded-lg bg-red-500/10 text-red-500 font-medium hover:bg-red-500/20 transition-colors mr-auto">
              {t('delete')}
            </button>
          )}
          <button onClick={onClose} className="px-4 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors">
            {t('cancel')}
          </button>
          <button onClick={handleSave} className="px-6 h-10 rounded-lg bg-nonsprimary text-white font-medium hover:bg-nonsprimaryfocus transition-colors">
            {isEditing ? t('save') : `${t('add')} ${type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Search the catalog for another entry of the same type and fold THIS entry into
// it: the picked entry survives, this one's editions/credits/signals move to it,
// and this row is deleted (backend POST /media/:keep/merge). On success the parent
// closes the modal and navigates to the survivor.
function MergeIntoSection({
  mediaId,
  type,
  fallbackTitle,
  onMerged,
}: {
  mediaId: string
  type: MediaType
  fallbackTitle: string
  onMerged: (keep: CatalogItem) => void
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // All setState happens inside the debounce callback (never synchronously in
    // the effect body), so this doesn't trigger cascading renders.
    const term = q.trim()
    const timer = setTimeout(() => {
      if (!term) {
        setResults([])
        return
      }
      setLoading(true)
      catalogService
        .getCatalog(term)
        .then((data) => setResults(data.filter((m) => m.type === type && m.id !== mediaId)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, type, mediaId])

  const pick = async (keep: CatalogItem) => {
    if (busy) return
    if (!window.confirm(t('confirmMergeInto', { title: fallbackTitle }))) return
    setBusy(true)
    try {
      await librarianService.mergeMedia(keep.id, { id: mediaId })
      onMerged(keep)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="relative">
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
        <div className="mt-2 flex flex-col gap-1.5">
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
                onClick={() => pick(m)}
                disabled={busy}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
              >
                <IoGitMergeOutline className="h-3.5 w-3.5" />
                {t('mergeIntoEntry')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
