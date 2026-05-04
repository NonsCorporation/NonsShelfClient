import { useState, useEffect } from 'react'
import { IoClose, IoBookOutline, IoFilmOutline } from 'react-icons/io5'
import type { MediaItem } from '../types.ts'
import { useLanguage } from '../contexts/LanguageContext.tsx'

type MediaModalProps = {
  isOpen: boolean
  initialData?: Partial<MediaItem> & { id?: string }
  initialType?: 'book' | 'movie'
  onClose: () => void
  onSave: (data: Partial<MediaItem>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export default function MediaModal({ isOpen, initialData, initialType, onClose, onSave, onDelete }: MediaModalProps) {
  const { t } = useLanguage()
  
  // Decide if we are editing or creating
  const isEditing = !!initialData?.id
  const [type, setType] = useState<'book' | 'movie'>(initialData?.type || initialType || 'book')

  const [form, setForm] = useState({
    title: '',
    author: '',
    director: '',
    coverUrl: '',
    year: '',
    duration: '',
    description: '',
    pages: '',
    genre: '',
    tags: '',
    actors: ''
  })

  useEffect(() => {
    if (isOpen) {
      setType(initialData?.type || initialType || 'book')
      
      const genre = Array.isArray(initialData?.genre) ? initialData.genre.join(', ') : initialData?.genre || ''
      const tags = Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : initialData?.tags || ''
      const actors = Array.isArray(initialData?.actors) ? initialData.actors.join(', ') : initialData?.actors || ''

      setForm({
        title: initialData?.title || '',
        author: initialData?.author || '',
        director: initialData?.director || '',
        coverUrl: initialData?.coverUrl || '',
        year: initialData?.year?.toString() || '',
        duration: initialData?.duration || '',
        description: initialData?.description || '',
        pages: initialData?.pages?.toString() || '',
        genre,
        tags,
        actors
      })
    }
  }, [isOpen, initialData, initialType])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!form.title) return

    const baseData: Partial<MediaItem> = {
      type,
      title: form.title,
      author: form.author,
      coverUrl: form.coverUrl || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      description: form.description || undefined,
      genre: form.genre ? form.genre.split(',').map((g: string) => g.trim()).filter(Boolean) : undefined,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    }

    if (type === 'movie') {
      baseData.director = form.director || form.author
      baseData.duration = form.duration || undefined
      baseData.actors = form.actors ? form.actors.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined
    } else {
      baseData.pages = form.pages ? parseInt(form.pages) : undefined
    }

    await onSave(baseData)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--divider)] bg-[var(--surface)] flex-shrink-0 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">
              {isEditing ? t('editDetails') : t('addNewEntry')}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 tracking-wide">
              {isEditing ? t('updateInfo', { type: type === 'book' ? t('book').toLowerCase() : t('film').toLowerCase() }) : t('chooseTypeDesc')}
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
            </div>
          </div>
        )}

        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('title')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('title')} value={form.title} onChange={(e) => setForm(s => ({...s, title: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {type === 'book' ? t('author') : t('director')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={type === 'book' ? t('author') : t('director')} value={type === 'book' ? form.author : form.director} onChange={(e) => setForm(s => type === 'book' ? ({...s, author: e.target.value}) : ({...s, director: e.target.value}))} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('coverUrl')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('coverUrl')} value={form.coverUrl} onChange={(e) => setForm(s => ({...s, coverUrl: e.target.value}))} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('year')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('year')} value={form.year} onChange={(e) => setForm(s => ({...s, year: e.target.value}))} />
            </label>

            {type === 'book' ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
                {t('pages')}
                <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('pages')} value={form.pages} onChange={(e) => setForm(s => ({...s, pages: e.target.value}))} />
              </label>
            ) : (
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
            {t('tagsPlaceholder')}
            <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('tagsPlaceholder')} value={form.tags} onChange={(e) => setForm(s => ({...s, tags: e.target.value}))} />
          </label>

          {type === 'movie' && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('actorsPlaceholder')}
              <input className="h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('actorsPlaceholder')} value={form.actors} onChange={(e) => setForm(s => ({...s, actors: e.target.value}))} />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
            {t('synopsis')}
            <textarea rows={4} className="p-3 resize-none rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-nonsprimaryfocus)] transition-shadow" placeholder={t('synopsis')} value={form.description} onChange={(e) => setForm(s => ({...s, description: e.target.value}))} />
          </label>
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
          <button onClick={handleSave} className="px-6 h-10 rounded-lg bg-nonsprimary text-[var(--text)] font-medium hover:bg-nonsprimaryfocus shadow-md shadow-nonsprimary/20 transition-all">
            {isEditing ? t('save') : `${t('add')} ${type === 'book' ? t('book') : t('film')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
