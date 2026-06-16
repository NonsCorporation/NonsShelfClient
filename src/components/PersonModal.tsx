import { useEffect, useState } from 'react'
import { IoClose, IoPersonOutline, IoCloudDownloadOutline } from 'react-icons/io5'
import { librarianService } from '../services/librarianService'
import type { PersonSummary } from '../services/librarianService'
import { useLanguage } from '../contexts/LanguageContext'

type Props = {
  isOpen: boolean
  // When set, edit this person; otherwise create a new one.
  person?: PersonSummary | null
  // Prefill the name when creating (e.g. from a search query).
  initialName?: string
  onClose: () => void
  onSaved: (person: PersonSummary) => void
}

// Create or edit an author/person with full details: name, avatar, birth year, bio.
export default function PersonModal({ isOpen, person, initialName, onClose, onSaved }: Props) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', bio: '', birthDate: '', photoUrl: '', aliases: '' })
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setForm({
      name: person?.name ?? initialName ?? '',
      bio: person?.bio ?? '',
      birthDate: person?.birth_date ?? '',
      photoUrl: person?.photo_url ?? '',
      aliases: '',
    })
    // The search list doesn't carry aliases — fetch the full record when editing.
    if (person?.uuid) {
      let cancelled = false
      librarianService
        .getPerson(person.uuid)
        .then(({ person: p, aliases }) => {
          if (cancelled) return
          setForm((s) => ({
            ...s,
            bio: p.bio ?? s.bio,
            birthDate: p.birth_date ?? s.birthDate,
            photoUrl: p.photo_url ?? s.photoUrl,
            aliases: aliases.join(', '),
          }))
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [isOpen, person, initialName])

  if (!isOpen) return null

  const save = async () => {
    const name = form.name.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      const fields = {
        name,
        bio: form.bio.trim() || undefined,
        birth_date: form.birthDate.trim() || undefined,
        photo_url: form.photoUrl.trim() || undefined,
        aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
      }
      const saved = person?.uuid
        ? await librarianService.updatePerson(person.uuid, fields)
        : await librarianService.createPerson(fields)
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Pull bio/photo/birth date + name variants from TMDB into the form (needs a
  // stored TMDB id — set when the person was imported as cast/crew). The user can
  // still tweak the fields before saving.
  const importFromTMDB = async () => {
    if (!person?.uuid) return
    setImporting(true)
    setError('')
    try {
      await librarianService.enrichPersonFromTMDB(person.uuid)
      const { person: p, aliases } = await librarianService.getPerson(person.uuid)
      setForm({
        name: p.name ?? '',
        bio: p.bio ?? '',
        birthDate: p.birth_date ?? '',
        photoUrl: p.photo_url ?? '',
        aliases: aliases.join(', '),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  const input =
    'h-11 px-3 rounded-lg bg-[var(--input)] border border-[var(--border-subtle)] text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] transition-shadow'

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">
            {person?.uuid ? t('editPerson') : t('addAuthor')}
          </h3>
          <div className="flex items-center gap-2">
            {person?.uuid && (
              <button
                onClick={importFromTMDB}
                disabled={importing}
                title={t('importFromTmdb') || 'Import from TMDB'}
                className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
              >
                <IoCloudDownloadOutline className="h-4 w-4" />
                {importing ? t('importing') || 'Importing…' : 'TMDB'}
              </button>
            )}
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
              <IoClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {form.photoUrl ? (
            <img src={form.photoUrl} alt="" className="h-16 w-16 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
              <IoPersonOutline className="h-7 w-7 text-[var(--placeholder)]" />
            </span>
          )}
          <input
            className={`${input} flex-1`}
            placeholder={t('avatarUrl')}
            value={form.photoUrl}
            onChange={(e) => setForm((s) => ({ ...s, photoUrl: e.target.value }))}
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('name')}
          <input autoFocus className={input} placeholder={t('name')} value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('birthDate')}
          <input className={input} type="date" value={form.birthDate} onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('altNames')}
          <input className={input} placeholder={t('altNamesPlaceholder')} value={form.aliases} onChange={(e) => setForm((s) => ({ ...s, aliases: e.target.value }))} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('bio')}
          <textarea
            rows={4}
            className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            placeholder={t('bio')}
            value={form.bio}
            onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
          />
        </label>

        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            {t('cancel')}
          </button>
          <button onClick={save} disabled={busy || !form.name.trim()} className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
