import { useEffect, useState, useCallback } from 'react'
import { IoCloseCircle } from 'react-icons/io5'
import { librarianService } from '../services/librarianService'
import type { Credit, CreditRole } from '../services/librarianService'
import { useLanguage } from '../contexts/LanguageContext'
import PersonPicker from './PersonPicker'

// Localized role label, falling back to the capitalized key.
function roleLabel(t: (k: string) => string, role: string): string {
  const k = `role_${role}`
  const v = t(k)
  return v === k ? role.charAt(0).toUpperCase() + role.slice(1) : v
}

// Manage a media item's cast/crew: add people in roles (actor, producer,
// translator, …), each selectable like authors. Roles are filtered to the ones
// that fit the media type.
export default function CreditsManager({ mediaId, mediaType }: { mediaId: string; mediaType: string }) {
  const { t } = useLanguage()
  const [roles, setRoles] = useState<CreditRole[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [role, setRole] = useState('')
  const [character, setCharacter] = useState('')
  const [error, setError] = useState('')

  const reloadCredits = useCallback(() => {
    librarianService.getCredits(mediaId).then(setCredits).catch(() => setCredits([]))
  }, [mediaId])

  useEffect(() => {
    librarianService
      .getCreditRoles()
      .then((all) => {
        const applicable = all.filter((r) => r.kinds.includes(mediaType))
        setRoles(applicable)
        setRole((cur) => cur || applicable[0]?.role || '')
      })
      .catch(() => {})
    reloadCredits()
  }, [mediaId, mediaType, reloadCredits])

  const addPerson = async (personUuid: string) => {
    setError('')
    try {
      await librarianService.addCredit(mediaId, { person_uuid: personUuid, role, character: character || undefined })
      setCharacter('')
      reloadCredits()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (id: number) => {
    setError('')
    try {
      await librarianService.deleteCredit(mediaId, id)
      setCredits((cs) => cs.filter((c) => c.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Group existing credits by role, in the role catalog's order.
  const byRole = roles
    .map((r) => ({ role: r.role, items: credits.filter((c) => c.role === r.role) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      {byRole.map((g) => (
        <div key={g.role}>
          <h4 className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{roleLabel(t, g.role)}</h4>
          <div className="flex flex-wrap gap-2">
            {g.items.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] py-1 pl-3 pr-1.5 text-sm text-[var(--text)]">
                {c.person.name}
                {c.character ? <span className="text-[var(--text-muted)]"> · {c.character}</span> : null}
                <button onClick={() => remove(c.id)} title={t('delete')} className="text-[var(--text-muted)] hover:text-red-500">
                  <IoCloseCircle className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Add a credit: choose a role (+ character for actors), then pick a person. */}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          >
            {roles.map((r) => (
              <option key={r.role} value={r.role}>
                {roleLabel(t, r.role)}
              </option>
            ))}
          </select>
          {role === 'actor' && (
            <input
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              placeholder={t('character')}
              className="h-10 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
            />
          )}
        </div>
        <PersonPicker onPick={(p) => addPerson(p.uuid)} />
      </div>
    </div>
  )
}
