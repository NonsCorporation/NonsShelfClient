import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoPersonOutline, IoCloudDownloadOutline, IoCheckmark, IoSearch, IoAdd, IoTrashOutline, IoChevronUp, IoChevronDown } from 'react-icons/io5'
import { librarianService } from '../services/librarianService'
import type { PersonSummary, TmdbPersonSuggestion, OlPersonSuggestion, PersonAlias } from '../services/librarianService'
import { suggestionService } from '../services/suggestionService'
import { useLanguage } from '../contexts/LanguageContext'

// One editable name variant. lang '' means "unspecified".
type AliasRow = { name: string; lang: string }

// Language tags offered for a name variant. The first entries double as the
// display-priority order: English and Russian come first, then the remaining
// languages — so the alias list always leads with the most useful spellings.
const LANG_PRIORITY = ['en', 'ru', 'ro']
const LANG_OPTIONS = ['', 'en', 'ru', 'ro', 'uk', 'de', 'fr', 'es', 'it', 'pl', 'ja', 'zh', 'ko']

const langLabel = (code: string) => (code ? code.toUpperCase() : '—')

const langRank = (lang: string) => {
  const i = LANG_PRIORITY.indexOf((lang || '').toLowerCase())
  return i === -1 ? LANG_PRIORITY.length : i
}

// Order by language priority (EN, RU, RO, then others); stable within a tier so
// same-language names keep their entered order.
const sortAliases = (rows: AliasRow[]) => [...rows].sort((a, b) => langRank(a.lang) - langRank(b.lang))

// Map API aliases into editable rows (sorted), normalising a missing lang to ''.
const toAliasRows = (aliases: PersonAlias[]): AliasRow[] =>
  sortAliases(aliases.map((a) => ({ name: a.name, lang: a.lang ?? '' })))

type Props = {
  isOpen: boolean
  // When set, edit this person; otherwise create a new one.
  person?: PersonSummary | null
  // Prefill the name when creating (e.g. from a search query).
  initialName?: string
  onClose: () => void
  onSaved: (person: PersonSummary) => void
  suggestionMode?: boolean
  onSuggested?: () => void
}

// Create or edit an author/person with full details: name, avatar, birth year, bio.
export default function PersonModal({ isOpen, person, initialName, onClose, onSaved, suggestionMode, onSuggested }: Props) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ bio: '', birthDate: '', photoUrl: '' })
  // nameRows[0] is the canonical name (not deletable); the rest are aliases.
  const [nameRows, setNameRows] = useState<AliasRow[]>([{ name: '', lang: '' }])
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [suggestion, setSuggestion] = useState<TmdbPersonSuggestion | null>(null)
  const [applying, setApplying] = useState(false)
  const [importingOL, setImportingOL] = useState(false)
  const [olSuggestion, setOlSuggestion] = useState<OlPersonSuggestion | null>(null)
  const [applyingOL, setApplyingOL] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setForm({
      bio: person?.bio ?? '',
      birthDate: person?.birth_date ?? '',
      photoUrl: person?.photo_url ?? '',
    })
    setNameRows([{ name: person?.name ?? initialName ?? '', lang: person?.name_lang ?? '' }])
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
          }))
          setNameRows([
            { name: p.name, lang: p.name_lang ?? '' },
            ...toAliasRows(aliases),
          ])
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [isOpen, person, initialName])

  if (!isOpen) return null

  // Name list edits. Index 0 is always the canonical name (cannot be removed).
  const addName = () => setNameRows((rows) => [...rows, { name: '', lang: '' }])
  const updateName = (i: number, patch: Partial<AliasRow>) =>
    setNameRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeName = (i: number) => setNameRows((rows) => rows.filter((_, idx) => idx !== i))

  const moveUp = (i: number) => setNameRows((rows) => {
    if (i === 0) return rows
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i], next[i - 1]]
    return next
  })

  const moveDown = (i: number) => setNameRows((rows) => {
    if (i >= rows.length - 1) return rows
    const next = [...rows];
    [next[i], next[i + 1]] = [next[i + 1], next[i]]
    return next
  })

  const primaryName = nameRows[0]?.name.trim() ?? ''

  const save = async () => {
    if (!primaryName) return
    setBusy(true)
    setError('')
    try {
      const fields = {
        name: primaryName,
        name_lang: nameRows[0]?.lang || undefined,
        bio: form.bio.trim() || undefined,
        birth_date: form.birthDate.trim() || undefined,
        photo_url: form.photoUrl.trim() || undefined,
        aliases: nameRows
          .slice(1)
          .map((a) => ({ name: a.name.trim(), lang: a.lang || undefined }))
          .filter((a) => a.name),
      }
      if (suggestionMode && person?.uuid) {
        await suggestionService.submit('update_person', person.uuid, fields)
        onSuggested?.()
        return
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

  // Find a TMDB candidate (by stored id, or by name when none is stored) and show
  // it for confirmation before anything is written.
  const importFromTMDB = async () => {
    if (!person?.uuid) return
    setImporting(true)
    setError('')
    try {
      setSuggestion(await librarianService.suggestPersonFromTMDB(person.uuid))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  // Apply the confirmed suggestion: import its record, then reload the form so
  // the librarian can still tweak fields before saving.
  const acceptSuggestion = async () => {
    if (!person?.uuid || !suggestion) return
    setApplying(true)
    setError('')
    try {
      await librarianService.enrichPersonFromTMDB(person.uuid, suggestion.tmdb_id)
      const { person: p, aliases } = await librarianService.getPerson(person.uuid)
      setForm({ bio: p.bio ?? '', birthDate: p.birth_date ?? '', photoUrl: p.photo_url ?? '' })
      setNameRows([{ name: p.name, lang: p.name_lang ?? '' }, ...toAliasRows(aliases)])
      setSuggestion(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const importFromOL = async () => {
    if (!person?.uuid) return
    setImportingOL(true)
    setError('')
    try {
      setOlSuggestion(await librarianService.suggestPersonFromOL(person.uuid))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImportingOL(false)
    }
  }

  const acceptOLSuggestion = async () => {
    if (!person?.uuid || !olSuggestion) return
    setApplyingOL(true)
    setError('')
    try {
      await librarianService.enrichPersonFromOL(person.uuid, olSuggestion.ol_key)
      const { person: p, aliases } = await librarianService.getPerson(person.uuid)
      setForm({ bio: p.bio ?? '', birthDate: p.birth_date ?? '', photoUrl: p.photo_url ?? '' })
      setNameRows([{ name: p.name, lang: p.name_lang ?? '' }, ...toAliasRows(aliases)])
      setOlSuggestion(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplyingOL(false)
    }
  }

  // Merge the picked duplicate into this person (the survivor).
  // After merge, reload fresh aliases (dup's name is now an alias) then persist
  // everything — including the user's bio choice — via updatePerson so we get a
  // clean PersonSummary back for onSaved.
  const executeMerge = async (dupUuid: string, chosenBio?: string) => {
    if (!person?.uuid) return
    setMergeOpen(false)
    setBusy(true)
    setError('')
    try {
      await librarianService.mergePeople(person.uuid, dupUuid)
      const { person: freshP, aliases: freshAliases } = await librarianService.getPerson(person.uuid)
      const bio = chosenBio !== undefined ? chosenBio : form.bio.trim() || undefined
      const saved = await librarianService.updatePerson(person.uuid, {
        name: primaryName || freshP.name,
        name_lang: nameRows[0]?.lang || undefined,
        bio,
        birth_date: form.birthDate.trim() || undefined,
        photo_url: form.photoUrl.trim() || undefined,
        aliases: freshAliases,
      })
      setForm((f) => ({ ...f, bio: bio ?? '' }))
      setNameRows([{ name: saved.name, lang: saved.name_lang ?? '' }, ...toAliasRows(freshAliases)])
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
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
            {person?.uuid && !suggestionMode && (
              <>
                <button
                  onClick={importFromTMDB}
                  disabled={importing}
                  title={t('importFromTmdb') || 'Import from TMDB'}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
                >
                  <IoCloudDownloadOutline className="h-4 w-4" />
                  {importing ? t('importing') || 'Importing…' : 'TMDB'}
                </button>
                <button
                  onClick={importFromOL}
                  disabled={importingOL}
                  title="Import from OpenLibrary"
                  className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-50"
                >
                  <IoCloudDownloadOutline className="h-4 w-4" />
                  {importingOL ? t('importing') || 'Importing…' : 'OL'}
                </button>
                <button
                  onClick={() => setMergeOpen(true)}
                  title="Merge with duplicate"
                  className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-orange-400 hover:text-orange-400"
                >
                  Merge
                </button>
              </>
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

        <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('name')}
          <div className="flex flex-col gap-1.5">
            {nameRows.map((row, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {/* reorder column — up/down for every row; disabled at edges */}
                <div className="flex flex-shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:enabled:text-[var(--text)] disabled:opacity-20"
                  >
                    <IoChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === nameRows.length - 1}
                    className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:enabled:text-[var(--text)] disabled:opacity-20"
                  >
                    <IoChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <input
                  autoFocus={i === 0}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm font-normal text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  placeholder={t('name')}
                  value={row.name}
                  onChange={(e) => updateName(i, { name: e.target.value })}
                />
                <select
                  className="h-10 flex-shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-xs font-normal text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  value={row.lang}
                  onChange={(e) => updateName(i, { lang: e.target.value })}
                  title="Language"
                >
                  {(LANG_OPTIONS.includes(row.lang) ? LANG_OPTIONS : [row.lang, ...LANG_OPTIONS]).map((code) => (
                    <option key={code} value={code}>{langLabel(code)}</option>
                  ))}
                </select>

                {/* P badge for primary, trash for the rest */}
                {i === 0 ? (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                    <span className="select-none text-[10px] font-bold uppercase tracking-widest text-nonsprimary">P</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeName(i)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-red-400 hover:text-red-400"
                  >
                    <IoTrashOutline className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addName}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
            >
              <IoAdd className="h-4 w-4" />
              {t('addName')}
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
          {t('birthDate')}
          <input className={input} type="date" value={form.birthDate} onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))} />
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
          <button onClick={save} disabled={busy || !primaryName} className="h-10 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
            {t('save')}
          </button>
        </div>
      </div>

      {suggestion && (
        <TmdbSuggestionModal
          suggestion={suggestion}
          busy={applying}
          onAccept={acceptSuggestion}
          onDecline={() => setSuggestion(null)}
        />
      )}

      {olSuggestion && (
        <TmdbSuggestionModal
          suggestion={{
            tmdb_id: 0,
            name: olSuggestion.name,
            biography: olSuggestion.biography,
            photo_url: olSuggestion.photo_url,
            birthday: olSuggestion.birth_date,
            also_known_as: olSuggestion.also_known_as,
          }}
          busy={applyingOL}
          onAccept={acceptOLSuggestion}
          onDecline={() => setOlSuggestion(null)}
        />
      )}

      {mergeOpen && person && (
        <MergePersonModal
          survivor={person}
          survivorBio={form.bio}
          onConfirm={executeMerge}
          onCancel={() => setMergeOpen(false)}
        />
      )}
    </div>
  )
}

// Two-phase merge picker portaled over the edit modal.
// Phase 1: search for the duplicate.
// Phase 2: review name/bio differences and confirm.
function MergePersonModal({
  survivor,
  survivorBio,
  onConfirm,
  onCancel,
}: {
  survivor: PersonSummary
  survivorBio: string
  onConfirm: (dupUuid: string, chosenBio?: string) => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PersonSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<PersonSummary | null>(null)
  const [dupBio, setDupBio] = useState<string | null>(null)
  const [loadingDup, setLoadingDup] = useState(false)
  const [bioPick, setBioPick] = useState<'keep' | 'dup'>('keep')

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(() => {
      librarianService
        .searchPeople(q)
        .then((res) => setResults(res.filter((p) => p.uuid !== survivor.uuid)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [q, survivor.uuid])

  useEffect(() => {
    if (!picked) return
    setLoadingDup(true)
    librarianService
      .getPerson(picked.uuid)
      .then(({ person: p }) => { setDupBio(p.bio ?? null); setBioPick('keep') })
      .catch(() => setDupBio(null))
      .finally(() => setLoadingDup(false))
  }, [picked])

  const hasBothBios = survivorBio.trim() !== '' && dupBio != null && dupBio.trim() !== ''

  const confirm = () => {
    if (!picked) return
    onConfirm(picked.uuid, hasBothBios && bioPick === 'dup' ? dupBio! : undefined)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div onClick={onCancel} className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">Merge with duplicate</h3>

        {!picked ? (
          <>
            <p className="text-sm text-[var(--text-muted)]">
              Search for the duplicate. Their credits and aliases will be moved to <strong className="text-[var(--text)]">{survivor.name}</strong>.
            </p>
            <div className="relative">
              <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people…"
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </div>
            {searching && <p className="text-xs text-[var(--text-muted)]">…</p>}
            {results.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {results.map((p) => (
                  <button
                    key={p.uuid}
                    onClick={() => setPicked(p)}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-orange-400"
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--container-2)]">
                        <IoPersonOutline className="h-4 w-4 text-[var(--placeholder)]" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[var(--text)]">{p.name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{t('creditsCount', { n: p.credit_count })}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : loadingDup ? (
          <p className="py-4 text-center text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* selected dup card */}
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              {picked.photo_url ? (
                <img src={picked.photo_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--container-2)]">
                  <IoPersonOutline className="h-5 w-5 text-[var(--placeholder)]" />
                </span>
              )}
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{picked.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('creditsCount', { n: picked.credit_count })}</p>
              </div>
            </div>

            {/* name difference note */}
            {picked.name !== survivor.name && (
              <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
                "<strong className="text-[var(--text)]">{picked.name}</strong>" will become an alias of <strong className="text-[var(--text)]">{survivor.name}</strong>.
              </p>
            )}

            {/* bio picker — only when both sides have a bio */}
            {hasBothBios && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Which bio to keep?</p>
                {([
                  { value: 'keep' as const, label: survivor.name, bio: survivorBio },
                  { value: 'dup' as const, label: picked.name, bio: dupBio! },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      bioPick === opt.value
                        ? 'border-nonsprimary bg-[var(--primary-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-0.5 flex-shrink-0 accent-nonsprimary"
                      checked={bioPick === opt.value}
                      onChange={() => setBioPick(opt.value)}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text)]">{opt.label}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{opt.bio}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--text-muted)]">
              All of <strong className="text-[var(--text)]">{picked.name}</strong>'s credits will be moved to <strong className="text-[var(--text)]">{survivor.name}</strong>. This cannot be undone.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={picked ? () => setPicked(null) : onCancel}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {picked ? 'Back' : t('cancel')}
          </button>
          {picked && !loadingDup && (
            <button
              onClick={confirm}
              className="h-10 rounded-lg bg-orange-500 px-6 text-sm font-medium text-white hover:bg-orange-600"
            >
              Merge
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Confirmation popup for a TMDB person match: shows the photo + name + bio so the
// librarian can accept (import) or decline. Portaled to <body> so its fixed
// overlay isn't trapped by any transformed ancestor.
function TmdbSuggestionModal({
  suggestion,
  busy,
  onAccept,
  onDecline,
}: {
  suggestion: TmdbPersonSuggestion
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const { t } = useLanguage()
  if (typeof document === 'undefined') return null

  return createPortal(
    <div onClick={onDecline} className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5"
      >
        <h3 className="text-lg font-semibold tracking-wide text-[var(--text)]">{t('tmdbSuggestTitle')}</h3>

        <div className="flex gap-3">
          {suggestion.photo_url ? (
            <img src={suggestion.photo_url} alt="" className="h-24 w-24 flex-shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--surface)]">
              <IoPersonOutline className="h-9 w-9 text-[var(--placeholder)]" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text)]">{suggestion.name}</p>
            {suggestion.birthday && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{suggestion.birthday}</p>}
          </div>
        </div>

        {suggestion.biography && (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">
            {suggestion.biography}
          </p>
        )}

        <p className="text-xs text-[var(--text-muted)]">{t('tmdbSuggestHint')}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onDecline}
            disabled={busy}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {t('decline')}
          </button>
          <button
            onClick={onAccept}
            disabled={busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-nonsprimary px-6 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            <IoCheckmark className="h-4 w-4" />
            {busy ? t('importing') : t('accept')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
