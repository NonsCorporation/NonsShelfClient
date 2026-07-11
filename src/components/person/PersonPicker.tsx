import { useEffect, useState } from 'react'
import { IoSearch, IoPersonOutline, IoAdd } from 'react-icons/io5'
import { librarianService } from '@/services/librarianService'
import type { PersonSummary } from '@/services/librarianService'
import { useLanguage } from '@/contexts/LanguageContext'
import PersonModal from '@/components/person/PersonModal'

type Props = {
  // The currently linked person (for display), if any.
  current?: { uuid?: string; name?: string } | null
  // Called when a person is picked (existing or newly created).
  onPick: (person: PersonSummary) => void
}

// Searchable author selector: type to search existing people, pick one, or
// create a brand-new author (with full details) on the fly.
export default function PersonPicker({ current, onPick }: Props) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PersonSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      librarianService
        .searchPeople(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  const pick = (p: PersonSummary) => {
    onPick(p)
    setQ('')
    setResults([])
  }

  const term = q.trim()
  const exact = results.some((p) => p.name.toLowerCase() === term.toLowerCase())

  return (
    <div>
      {current?.name && (
        <p className="mb-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]">
          <IoPersonOutline className="h-4 w-4 text-nonsprimary" />
          {current.name}
        </p>
      )}

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchAuthorsPlaceholder')}
          className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>

      {term && (
        <div className="mt-2 flex flex-col gap-1.5">
          {loading && <p className="text-xs text-[var(--text-muted)]">…</p>}
          {results.map((p) => (
            <button
              key={p.uuid}
              onClick={() => pick(p)}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-nonsprimary"
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
          {!loading && !exact && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text)] transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
            >
              <IoAdd className="h-4 w-4 text-nonsprimary" />
              {t('createAndLink', { name: term })}
            </button>
          )}
        </div>
      )}

      <PersonModal
        isOpen={creating}
        initialName={term}
        onClose={() => setCreating(false)}
        onSaved={(p) => {
          setCreating(false)
          pick(p)
        }}
      />
    </div>
  )
}
