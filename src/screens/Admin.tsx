'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { IoSearch } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import GlowingHorizon from '../components/badges/GlowingHorizon'
import { useAuth } from '../contexts/AuthContext'
import {
  getBillingTimeline,
  grantHorizon,
  revokeEntitlement,
  type AdminEntitlement,
  type BillingTimeline,
} from '../services/horizonAdminService'

// /admin — the admin panel (admins only; everyone else gets a 404). For now: look a
// user up, see their Horizon and billing history, give or take back Horizon by hand.
// An internal tool, so it is in English only.

const INPUT =
  'h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'
const BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40'

// Read when a lookup finishes (from an event handler), never while rendering.
const nowSeconds = () => Math.floor(Date.now() / 1000)

const when = (unix?: number | null) => (unix ? new Date(unix * 1000).toLocaleString() : '—')
const money = (minor: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-muted)]">{children}</p>
}

export default function Admin() {
  const { user, loading } = useAuth()
  const [query, setQuery] = useState('')
  const [who, setWho] = useState('') // the user currently shown
  const [timeline, setTimeline] = useState<BillingTimeline | null>(null)
  const [loadedAt, setLoadedAt] = useState(0) // unix seconds when the timeline was read; what "ended" is judged against
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Grant form
  const [days, setDays] = useState('30')
  const [lifetime, setLifetime] = useState(false)
  const [source, setSource] = useState<'gift' | 'staff' | 'promo'>('gift')
  const [note, setNote] = useState('')

  if (loading) return <Layout>{null}</Layout>
  // Not an admin: there is no such page.
  if (user?.role !== 'admin') notFound()

  const load = async (ref: string) => {
    setBusy(true)
    setError('')
    const r = await getBillingTimeline(ref)
    setBusy(false)
    if (!r.ok) {
      setTimeline(null)
      setError(r.status === 404 ? 'No such user.' : r.error)
      return
    }
    setWho(ref.trim())
    setLoadedAt(nowSeconds())
    setTimeline(r)
  }

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setNotice('')
    if (query.trim()) void load(query)
  }

  const grant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!who) return
    const n = Number(days)
    if (!lifetime && !(Number.isInteger(n) && n > 0)) {
      setError('Enter a number of days.')
      return
    }
    setBusy(true)
    setError('')
    const r = await grantHorizon({ user: who, source, days: n, lifetime, note })
    if (!r.ok) {
      setBusy(false)
      setError(r.error)
      return
    }
    setNotice(lifetime ? 'Gave Horizon for life.' : `Gave Horizon for ${n} day${n === 1 ? '' : 's'}.`)
    setNote('')
    await load(who)
  }

  const revoke = async (e: AdminEntitlement) => {
    if (!window.confirm(`End entitlement #${e.id} (${e.source}) now?`)) return
    setBusy(true)
    setError('')
    const r = await revokeEntitlement(e.id)
    if (!r.ok) {
      setBusy(false)
      setError(r.error)
      return
    }
    setNotice(`Ended entitlement #${e.id}.`)
    await load(who)
  }

  const h = timeline?.horizon

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Admin panel</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Horizon: look a user up, see their billing, give or take back Horizon.</p>

        <form onSubmit={search} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Username or user id"
              aria-label="Username or user id"
              className={`${INPUT} w-full pl-9`}
            />
          </div>
          <button type="submit" disabled={busy || !query.trim()} className={`${BTN} bg-nonsprimary text-white hover:bg-nonsprimaryfocus`}>
            Look up
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && <p className="mt-3 text-sm text-emerald-500">{notice}</p>}

        {timeline && h && (
          <div className="mt-6 flex flex-col gap-4">
            <Card title={`Horizon — ${who}`}>
              <div className="flex flex-wrap items-center gap-3">
                {h.active ? (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <GlowingHorizon /> Active
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-[var(--text-muted)]">Not active</span>
                )}
                {h.active && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {h.lifetime ? 'for life' : `until ${when(h.until)}`}
                    {h.source ? ` · ${h.source}` : ''}
                    {h.plan ? ` · ${h.plan}` : ''}
                    {h.cancel_at_period_end ? ' · canceled, runs out' : h.renews ? ` · renews ${when(h.renews_at)}` : ''}
                  </span>
                )}
              </div>
            </Card>

            <Card title="Give Horizon">
              <form onSubmit={grant} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                  Days
                  <input
                    type="number"
                    min={1}
                    max={36500}
                    value={days}
                    disabled={lifetime}
                    onChange={(e) => setDays(e.target.value)}
                    className={`${INPUT} w-24 disabled:opacity-40`}
                  />
                </label>
                <label className="flex h-10 items-center gap-2 text-sm text-[var(--text)]">
                  <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} className="h-4 w-4 accent-nonsprimary" />
                  For life
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                  Type
                  <select value={source} onChange={(e) => setSource(e.target.value as 'gift' | 'staff' | 'promo')} className={INPUT}>
                    <option value="gift">gift</option>
                    <option value="staff">staff</option>
                    <option value="promo">promo</option>
                  </select>
                </label>
                <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
                  Note (optional)
                  <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={INPUT} />
                </label>
                <button type="submit" disabled={busy} className={`${BTN} bg-nonsprimary text-white hover:bg-nonsprimaryfocus`}>
                  Give
                </button>
              </form>
            </Card>

            <Card title="Entitlements">
              {timeline.entitlements.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {timeline.entitlements.map((e) => {
                    const ended = !!e.revoked_at || (e.ends_at !== null && e.ends_at <= loadedAt)
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium text-[var(--text)]">
                            #{e.id} · {e.source}
                          </span>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {when(e.starts_at)} → {e.ends_at === null ? 'for life' : when(e.ends_at)}
                            {e.revoked_at ? ` · revoked ${when(e.revoked_at)}` : ''}
                            {e.note ? ` · ${e.note}` : ''}
                          </span>
                        </span>
                        {ended ? (
                          <span className="text-xs text-[var(--text-muted)]">ended</span>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => void revoke(e)} className="text-xs font-medium text-red-400 hover:underline disabled:opacity-40">
                            End now
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card title="Subscriptions">
              {timeline.subscriptions.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {timeline.subscriptions.map((s) => (
                    <li key={s.id} className="py-2 text-sm text-[var(--text)]">
                      {s.plan || '—'} · {s.status} · {money(s.amount, s.currency)}
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        period ends {when(s.current_period_end)}
                        {s.cancel_at_period_end ? ' · cancels at period end' : ''}
                        {s.ended_at ? ` · ended ${when(s.ended_at)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Payments">
              {timeline.payments.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {timeline.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-[var(--text)]">
                        {when(p.paid_at)}
                        <span className="ml-2 text-xs text-[var(--text-muted)]">{p.reason}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={`text-xs ${p.status === 'paid' ? 'text-[var(--text-muted)]' : 'text-amber-500'}`}>{p.status}</span>
                        <span className="font-medium tabular-nums text-[var(--text)]">{money(p.amount, p.currency)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Webhook events">
              {timeline.events.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {timeline.events.map((ev) => (
                    <li key={ev.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                      <span className="text-[var(--text)]">{ev.type}</span>
                      <span className={ev.error ? 'text-red-400' : 'text-[var(--text-muted)]'}>{ev.error || when(ev.received_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}
