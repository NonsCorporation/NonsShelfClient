'use client'

import { useCallback, useEffect, useState } from 'react'
import { IoSearch } from 'react-icons/io5'
import { Link } from '@/lib/router'
import GlowingHorizon from '@/components/badges/GlowingHorizon'
import { useAuth } from '@/contexts/AuthContext'
import { searchPanelUsers, setPanelUserRoles, type AdminPanelUser } from '@/services/horizonAdminService'

// Admin panel → Users: find people, see their roles and Horizon, and give or take
// away the librarian role (and, for super admins, the admin role). An internal tool,
// so it is in English only.

const INPUT =
  'h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

const ROLE_STYLE: Record<string, string> = {
  super_admin: 'bg-amber-500/15 text-amber-500',
  admin: 'bg-nonsprimary/15 text-nonsprimaryfocus',
  librarian: 'bg-[#c23f6b]/15 text-[#e0627f]',
}

export default function UsersAdmin() {
  const { user: me } = useAuth()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminPanelUser[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (q: string) => {
    const r = await searchPanelUsers(q)
    if (r.ok) {
      setUsers(r.users)
      setError('')
    } else setError(r.error)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read: the newest accounts
    void load('')
  }, [load])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setNotice('')
    void load(query)
  }

  const toggleRole = async (u: AdminPanelUser, role: string) => {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role]
    setBusyId(u.id)
    setError('')
    const r = await setPanelUserRoles(u.id, roles)
    setBusyId(null)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setNotice(`${u.username}: ${r.user.roles.length ? r.user.roles.join(', ') : 'no extra roles'}.`)
    setUsers((prev) => prev?.map((x) => (x.id === u.id ? r.user : x)) ?? prev)
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Username, email, name or id" aria-label="Search users" className={INPUT} />
        </div>
        <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-nonsprimary px-4 text-sm font-medium text-white hover:bg-nonsprimaryfocus">
          Search
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-emerald-500">{notice}</p>}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{query.trim() ? 'Results' : 'Newest accounts'}</h3>
        {users === null ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No users found.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {users.map((u) => {
              const self = u.id === me?.id
              return (
                <li key={u.id} className={`flex flex-col gap-2 py-3 ${u.deleted ? 'opacity-50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/u/${encodeURIComponent(u.username)}`} className="text-sm font-semibold text-[var(--text)] hover:text-nonsprimary">
                      {u.name}
                    </Link>
                    <span className="text-xs text-[var(--text-muted)]">
                      @{u.username} · #{u.id}
                    </span>
                    {u.horizon && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#f5a623]">
                        <GlowingHorizon className="h-3.5 w-3.5" /> Horizon
                      </span>
                    )}
                    {u.banned && <span className="text-xs text-red-400">banned</span>}
                    {u.deleted && <span className="text-xs text-[var(--text-muted)]">deleted</span>}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.roles.map((r) => (
                      <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLE[r] ?? 'bg-[var(--container)] text-[var(--text-muted)]'}`}>
                        {r}
                      </span>
                    ))}
                    {u.roles.length === 0 && <span className="text-[11px] text-[var(--text-muted)]">user</span>}
                    {!u.deleted && !self && (
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => void toggleRole(u, 'librarian')}
                          className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-40"
                        >
                          {u.roles.includes('librarian') ? 'Remove librarian' : 'Make librarian'}
                        </button>
                        {/* Only a super admin can do this; the server refuses anyone else. */}
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => void toggleRole(u, 'admin')}
                          className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary disabled:opacity-40"
                        >
                          {u.roles.includes('admin') ? 'Remove admin' : 'Make admin'}
                        </button>
                      </span>
                    )}
                    {self && <span className="ml-auto text-[11px] text-[var(--text-muted)]">you</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <p className="text-xs text-[var(--text-muted)]">
        Anyone can be made a librarian by an admin. Giving or taking away the admin role needs a super admin, and nobody can change their own roles.
      </p>
    </div>
  )
}
