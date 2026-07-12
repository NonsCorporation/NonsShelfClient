import { useEffect, useMemo, useState } from 'react'
import { IoClose, IoAdd } from 'react-icons/io5'
import { librarianService } from '@/services/librarianService'
import type { Genre } from '@/services/librarianService'
import { useLanguage } from '@/contexts/LanguageContext'

// Module-level cache: the genre catalog rarely changes mid-session and every
// open of the edit modal would otherwise re-fetch it. Shared across every
// GenrePicker instance on the page.
let catalogCache: Promise<Genre[]> | null = null
function loadCatalog(): Promise<Genre[]> {
  if (!catalogCache) catalogCache = librarianService.listGenres().catch((e) => { catalogCache = null; throw e })
  return catalogCache
}

// Searchable multi-select for a catalog item's genres: type to filter the
// normalized genre catalog, pick a match (chip), or add a new one on the fly
// if nothing matches — mirrors PersonPicker's search-then-pick-or-create
// pattern. `value`/`onChange` are the same comma-separated string the rest of
// the edit form already works with, so this drops into MediaModal in place
// of the old freeform text input with no other plumbing changes.
export default function GenrePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLanguage()
  const [catalog, setCatalog] = useState<Genre[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCatalog().then((items) => { if (!cancelled) setCatalog(items) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selected = useMemo(
    () => value.split(',').map((g) => g.trim()).filter(Boolean),
    [value],
  )

  const term = q.trim().toLowerCase()
  const matches = term
    ? catalog.filter((g) => g.name.toLowerCase().includes(term) && !selected.some((s) => s.toLowerCase() === g.name.toLowerCase()))
    : []
  const exact = matches.some((g) => g.name.toLowerCase() === term) || selected.some((s) => s.toLowerCase() === term)

  const commit = (raw: string) => {
    const name = raw.trim()
    if (!name || selected.some((s) => s.toLowerCase() === name.toLowerCase())) {
      setQ('')
      return
    }
    onChange([...selected, name].join(', '))
    setQ('')
  }

  const remove = (name: string) => {
    onChange(selected.filter((s) => s !== name).join(', '))
  }

  return (
    <div className="relative">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-nonsprimaryfocus)]">
        {selected.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-md bg-nonsprimary/15 px-2 py-0.5 text-sm text-nonsprimary">
            {name}
            <button type="button" onClick={() => remove(name)} className="hover:text-red-500">
              <IoClose className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit(q)
            } else if (e.key === 'Backspace' && !q && selected.length > 0) {
              remove(selected[selected.length - 1])
            }
          }}
          placeholder={selected.length ? '' : t('genrePlaceholder')}
          className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none"
        />
      </div>

      {open && term && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] py-1 shadow-lg">
          {matches.map((g) => (
            <button
              key={g.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(g.name) }}
              className="block w-full px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-nonsprimary/10"
            >
              {g.name}
            </button>
          ))}
          {!exact && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(q) }}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm text-nonsprimary hover:bg-nonsprimary/10"
            >
              <IoAdd className="h-4 w-4" />
              {t('genreAddNew', { name: q.trim() })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
