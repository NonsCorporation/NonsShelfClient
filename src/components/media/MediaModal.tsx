import { useState, useEffect, useCallback } from 'react'
import { IoClose, IoBookOutline, IoFilmOutline, IoTvOutline, IoCloudDownloadOutline } from 'react-icons/io5'
import { TbSpy } from 'react-icons/tb'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useNavigate } from '@/lib/router'
import type { MediaItem, MediaType, ShelfStatus } from '@/types.ts'
import { useLanguage } from '@/contexts/LanguageContext.tsx'
import { STATUS_ORDER, STATUS_COLOR, statusLabel } from '@/lib/shelf'
import { mediaPath } from '@/lib/paths'
import EditionsManager from '@/components/media/EditionsManager'
import GenreSuggestions from '@/components/media/GenreSuggestions'
import GenrePicker from '@/components/media/GenrePicker'
import EpisodesManager from '@/components/media/EpisodesManager'
import CreditsManager from '@/components/person/CreditsManager'
import ConnectionsManager from '@/components/connections/ConnectionsManager'
import PersonPicker from '@/components/person/PersonPicker'
import MediaPicker from '@/components/media/MediaPicker'
import { librarianService } from '@/services/librarianService'
import { downloadCoverToB2 } from '@/lib/api'
import { suggestionService } from '@/services/suggestionService'
import { SuggestionProvider } from '@/contexts/SuggestionContext'
import type { CatalogItem } from '@/services/catalogService'

type MediaModalProps = {
  isOpen: boolean
  initialData?: Partial<MediaItem> & { id?: string }
  initialType?: 'book' | 'movie'
  catalogOnly?: boolean
  withEditions?: boolean
  suggestionMode?: boolean
  mediaUuid?: string
  onClose: () => void
  onSave: (data: Partial<MediaItem>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function MediaModal({ isOpen, initialData, initialType, catalogOnly, withEditions, suggestionMode, mediaUuid, onClose, onSave, onDelete }: MediaModalProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  // Decide if we are editing or creating
  const isEditing = !!initialData?.id
  // Series rows aren't created from this form (they're seeded), but an existing
  // one can be edited here — so the state holds the full MediaType and anything
  // non-book uses the film-style fields.
  const [type, setType] = useState<MediaType>(initialData?.type || initialType || 'book')
  const [status, setStatus] = useState<ShelfStatus>(initialData?.status || 'wishlist')
  // purely visual for now — not yet wired to any share/privacy behavior
  const [incognito, setIncognito] = useState(false)
  const [incognitoToast, setIncognitoToast] = useState(false)
  const showIncognitoToast = () => {
    setIncognitoToast(true)
    setTimeout(() => setIncognitoToast(false), 2000)
  }

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
    tmdbId: '',
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
        tmdbId: initialData?.tmdbId?.toString() || '',
      })
    }
  }, [isOpen, initialData, initialType])

  const [downloadingCover, setDownloadingCover] = useState(false)
  const [coverError, setCoverError] = useState('')
  // Guards against a double-submit: while the save request is in flight the
  // modal is still open (it only closes once onSave resolves), so without this
  // rapid clicks would each POST a fresh media row — creating duplicate entries.
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const targetRef = mediaUuid ?? initialData?.id ?? ''

  const handleDownloadCover = async () => {
    if (!form.coverUrl) return
    setDownloadingCover(true)
    setCoverError('')
    try {
      const cdnUrl = await downloadCoverToB2(form.coverUrl)
      setForm((s) => ({ ...s, coverUrl: cdnUrl }))
      if (isEditing) {
        const baseData: Partial<MediaItem> = {
          type,
          status,
          title: form.title,
          titleEn: form.originalTitle.trim() || undefined,
          author: form.author,
          coverUrl: cdnUrl,
          year: form.year ? parseInt(form.year) : undefined,
          description: form.description || undefined,
          genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : undefined,
        }
        if (type !== 'book') {
          baseData.director = form.director || form.author
          baseData.duration = form.duration || undefined
          baseData.tmdbId = form.tmdbId ? parseInt(form.tmdbId, 10) : undefined
        }
        await onSave(baseData)
      }
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Failed to download cover')
    } finally {
      setDownloadingCover(false)
    }
  }

  const handleSave = async () => {
    if (!form.title || saving) return

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
      baseData.tmdbId = form.tmdbId ? parseInt(form.tmdbId, 10) : undefined
    }

    setSaving(true)
    try {
      await onSave(baseData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuggestionProvider isSuggestionMode={suggestionMode ?? false}>
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-[var(--overlay)] flex items-end pb-28 sm:pb-0 sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--container)] overflow-hidden flex flex-col max-h-[calc(100svh-8rem)] sm:max-h-[90vh]">
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => (incognito ? setIncognito(false) : setConfirmingIncognito(true))}
                  title={incognito ? 'Incognito on' : 'Incognito off'}
                  aria-pressed={incognito}
                  className={`flex flex-shrink-0 items-center justify-center rounded-xl border p-2 transition-colors ${
                    incognito
                      ? 'border-transparent bg-nonsprimary/20 text-nonsprimary'
                      : 'border-[var(--text)]/70 text-[var(--text-muted)] hover:border-nonsprimary hover:text-[var(--text)]'
                  }`}
                >
                  <TbSpy className="h-4 w-4" />
                </button>
                <div className="inline-flex flex-1 rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                        status === s ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: incognito ? 'var(--text-muted)' : STATUS_COLOR[s] }} />
                      {statusLabel(type, s, t)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {confirmingIncognito && (
            <ConfirmModal
              title="Go incognito?"
              message={`Are you sure you want to make this ${type} private?`}
              confirmText="Make private"
              cancelText={t('cancel')}
              variant="primary"
              onConfirm={() => { setConfirmingIncognito(false); setIncognito(true) }}
              onCancel={() => setConfirmingIncognito(false)}
            />
          )}

          {/* For books in edit mode, title is managed per-edition; hide the
              work-level title field to avoid confusion. Always show for new
              entries and for movies/series where there are no per-item editions. */}
          {!(withEditions && isEditing && type === 'book') && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('title')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('title')} value={form.title} onChange={(e) => setForm(s => ({...s, title: e.target.value}))} />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('originalTitle')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('originalTitle')} value={form.originalTitle} onChange={(e) => setForm(s => ({...s, originalTitle: e.target.value}))} />
          </label>

          {/* Author/director text input — hidden when PersonPicker is available,
              since picking a person already writes back to form.author/director. */}
          {!(withEditions && isEditing) && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {type === 'book' ? t('author') : t('director')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={type === 'book' ? t('author') : t('director')} value={type === 'book' ? form.author : form.director} onChange={(e) => setForm(s => type === 'book' ? ({...s, author: e.target.value}) : ({...s, director: e.target.value}))} />
            </label>
          )}

          {/* Link the author/director to a person entity (searchable + creatable). */}
          {withEditions && isEditing && initialData?.id && (
            <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {type === 'book' ? t('linkAuthor') : t('linkDirector')}
              <PersonPicker
                current={{ uuid: initialData.makerUuid, name: type === 'book' ? form.author : form.director }}
                onPick={async (p) => {
                  setForm((s) => (type === 'book' ? { ...s, author: p.name } : { ...s, director: p.name }))
                  const role = type === 'book' ? 'author' : 'director'
                  if (suggestionMode) {
                    await suggestionService.submit('set_maker', targetRef, { person_uuid: p.uuid, role }).catch(() => {})
                  } else {
                    await librarianService.setMaker(initialData.id!, p.uuid, role).catch(() => {})
                  }
                }}
              />
            </div>
          )}

          {type !== 'book' && (
            <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              <span>{t('coverUrl')}</span>
              <div className="flex gap-2">
                <input className="h-11 px-3 flex-1 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('coverUrl')} value={form.coverUrl} onChange={(e) => setForm(s => ({...s, coverUrl: e.target.value}))} />
                <button
                  type="button"
                  onClick={handleDownloadCover}
                  disabled={!form.coverUrl || downloadingCover}
                  title="Download cover to CDN"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50 transition-colors"
                >
                  <IoCloudDownloadOutline className="h-4 w-4" />
                  {downloadingCover ? '…' : 'CDN'}
                </button>
              </div>
              {coverError && <p className="text-xs text-red-500">{coverError}</p>}
            </div>
          )}

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

          {/* TMDB id — editable so a merge that lost it, or a wrong/missing
              match, can be corrected by hand. Movies/series only; books use
              ISBN/OpenLibrary identity instead. */}
          {type !== 'book' && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              TMDB ID
              <input
                type="number"
                className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow"
                placeholder="e.g. 872585"
                value={form.tmdbId}
                onChange={(e) => setForm(s => ({...s, tmdbId: e.target.value}))}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('genrePlaceholder')}
            <GenrePicker value={form.genre} onChange={(genre) => setForm((s) => ({ ...s, genre }))} />
          </label>

          {/* AI genre suggestions — librarian reviews each proposal; approving
              writes straight to the catalog row server-side, so mirror it into
              the form here too. Existing catalog rows only (needs a media id). */}
          {withEditions && isEditing && initialData?.id && !suggestionMode && (
            <GenreSuggestions
              mediaId={initialData.id}
              onApplied={(genreName) =>
                setForm((s) => {
                  const existing = s.genre.split(',').map((g) => g.trim()).filter(Boolean)
                  if (existing.some((g) => g.toLowerCase() === genreName.toLowerCase())) return s
                  return { ...s, genre: [...existing, genreName].join(', ') }
                })
              }
            />
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('synopsis')}
            <textarea rows={4} className="p-3 resize-none rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('synopsis')} value={form.description} onChange={(e) => setForm(s => ({...s, description: e.target.value}))} />
          </label>

          {/* Cast & crew — credits in roles (actors, producers, translators, …). */}
          {withEditions && isEditing && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('castAndCrew')}</span>
              <CreditsManager mediaId={initialData.id} mediaUuid={mediaUuid} mediaType={type} />
            </div>
          )}

          {/* Alternative titles — movie/series only; import from TMDB and display stored ones. */}
          {withEditions && isEditing && type !== 'book' && initialData?.id && !suggestionMode && (
            <AltTitlesSection mediaId={initialData.id} />
          )}

          {/* Editions manager — only when editing an existing book. */}
          {withEditions && isEditing && type === 'book' && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('editionsTitle')}</span>
              <EditionsManager mediaId={initialData.id} mediaUuid={mediaUuid} fallbackTitle={form.title} fallbackAuthor={form.author} />
            </div>
          )}

          {/* Episodes manager — only when editing an existing series. */}
          {withEditions && isEditing && type === 'series' && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('episodesTitle')}</span>
              <EpisodesManager mediaId={initialData.id} />
            </div>
          )}

          {/* Connections — series membership, universe, and adaptation links.
              Applies to every catalog type (book/movie/series). */}
          {withEditions && isEditing && initialData?.id && (
            <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
              <span className="text-sm font-medium text-[var(--text)]">{t('connectionsEditorTitle')}</span>
              <p className="text-xs text-[var(--text-muted)]">{t('connectionsEditorHint')}</p>
              <ConnectionsManager item={initialData as MediaItem} />
            </div>
          )}

          {/* Merge THIS entry into another one (this entry disappears). Books and
              movies only — series merge would leave episodes/watches orphaned. */}
          {withEditions && isEditing && initialData?.id && type !== 'series' && !suggestionMode && (
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
          <button onClick={handleSave} disabled={saving} className="px-6 h-10 rounded-lg bg-nonsprimary text-white font-medium hover:bg-nonsprimaryfocus transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isEditing ? t('save') : `${t('add')} ${type === 'book' ? t('book') : type === 'series' ? t('series') : t('film')}`}
          </button>
        </div>
      </div>
    </div>
    </SuggestionProvider>
  )
}

type AltTitle = { id: number; country_code: string; language: string; title: string; overview: string; title_type: string }

function AltTitlesSection({ mediaId }: { mediaId: string }) {
  const [titles, setTitles] = useState<AltTitle[]>([])
  const [importing, setImporting] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    librarianService.getAltTitles(mediaId).then(setTitles).catch(() => {})
  }, [mediaId])

  useEffect(() => { load() }, [load])

  const handleImport = async () => {
    setImporting(true)
    try {
      await librarianService.importAltTitles(mediaId)
      load()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--divider)] pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text)]">
          Alternative titles{titles.length > 0 ? ` (${titles.length})` : ''}
        </span>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
        >
          <IoCloudDownloadOutline className="h-3.5 w-3.5 text-nonsprimary" />
          {importing ? 'Importing…' : 'Import from TMDB'}
        </button>
      </div>
      {titles.length > 0 ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]">
          {titles.map((t) => (
            <div
              key={t.id}
              className="border-b border-[var(--border-subtle)] last:border-0"
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-hover)]"
              >
                <span className="w-8 flex-shrink-0 font-mono font-semibold uppercase text-[var(--text-muted)]">
                  {t.language || t.country_code}
                </span>
                <span className="flex-1 text-[var(--text)]">{t.title}</span>
                {t.title_type && (
                  <span className="flex-shrink-0 italic text-[var(--text-muted)]">{t.title_type}</span>
                )}
                {t.overview && (
                  <span className="flex-shrink-0 text-[var(--text-muted)]">{expanded === t.id ? '▲' : '▼'}</span>
                )}
              </button>
              {expanded === t.id && t.overview && (
                <p className="px-3 pb-2 text-xs leading-5 text-[var(--text-muted)]">{t.overview}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">No alternative titles stored. Import from TMDB above.</p>
      )}
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
  const [busy, setBusy] = useState(false)

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
    <fieldset disabled={busy} className="contents">
      <MediaPicker type={type} excludeId={mediaId} onPick={pick} />
    </fieldset>
  )
}
