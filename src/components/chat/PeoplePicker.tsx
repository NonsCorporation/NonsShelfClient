'use client'

import { useEffect, useState } from 'react'
import { IoCheckmarkCircle, IoClose, IoSearchOutline } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { searchUsers, type UserHit } from '@/services/userService'
import { PersonAvatar } from './chatFormat'

type Props = {
  meId: number
  /** Single mode: picking someone calls onPick right away. */
  onPick?: (u: UserHit) => void
  /** Multi mode: the selected people (controlled). */
  selected?: UserHit[]
  onToggle?: (u: UserHit) => void
  /** Already in the chat — shown but not pickable. */
  excludeIds?: number[]
  busyId?: number | null
}

// User search used by "new message", "new group" and "add members". Debounced
// against /api/search/users (exact matches first); yourself is never listed.
export default function PeoplePicker({ meId, onPick, selected, onToggle, excludeIds = [], busyId = null }: Props) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = q.trim()
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!query) {
        if (!cancelled) {
          setHits([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const res = await searchUsers(query, 20)
      if (!cancelled) {
        setHits(res.filter((u) => u.id !== meId))
        setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q, meId])

  const isSelected = (id: number) => !!selected?.some((s) => s.id === id)

  return (
    <div className="flex min-h-0 flex-col">
      {selected && selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => onToggle?.(u)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] py-1 pl-1 pr-2 text-xs font-medium text-nonsprimary"
            >
              <PersonAvatar p={u} size={20} />
              {u.name || u.username}
              <IoClose className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <IoSearchOutline className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('chatSearchPeople')}
          aria-label={t('chatSearchPeople')}
          className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      <div className="mt-2 max-h-72 min-h-[120px] overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('loading')}</p>
        ) : q.trim() && hits.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('chatNoPeople')}</p>
        ) : (
          <ul>
            {hits.map((u) => {
              const excluded = excludeIds.includes(u.id)
              const sel = isSelected(u.id)
              return (
                <li key={u.id}>
                  <button
                    disabled={excluded || busyId === u.id}
                    onClick={() => (onPick ? onPick(u) : onToggle?.(u))}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--surface)] disabled:cursor-default disabled:opacity-50"
                  >
                    <PersonAvatar p={u} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">{u.name || u.username}</span>
                      <span className="block truncate font-mono text-xs text-[var(--text-muted)]">@{u.username}</span>
                    </span>
                    {excluded ? (
                      <span className="text-[11px] text-[var(--text-muted)]">{t('chatAlreadyIn')}</span>
                    ) : sel ? (
                      <IoCheckmarkCircle className="h-5 w-5 text-nonsprimary" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
