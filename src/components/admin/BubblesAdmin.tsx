'use client'

import { useCallback, useEffect, useState } from 'react'
import { IoPencilOutline, IoTrashOutline } from 'react-icons/io5'
import GreetingBubble from '@/components/feed/GreetingBubble'
import ColorPicker from '@/components/ui/ColorPicker'
import { BUBBLE_ICONS, DEFAULT_BUBBLE_ICON, bubbleIcon } from '@/lib/bubbleIcons'
import {
  deleteBubble,
  listAllBubbles,
  saveBubble,
  type Bubble,
  type BubbleAudience,
  type BubbleInput,
} from '@/services/bubbleService'

// Admin panel → Bubbles: create and manage the message pills on the home feed. An
// internal tool, so it is in English only.

const INPUT =
  'h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'
const BTN = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40'
const LABEL = 'flex flex-col gap-1 text-xs text-[var(--text-muted)]'

const SWATCHES = ['#8b7bd8', '#f5a623', '#e8a33a', '#4fd1c5', '#e0627f', '#5aa9e6', '#7bc96f', '#c9c9d1']

const EMPTY: BubbleInput = {
  text: '',
  href: '/',
  icon: DEFAULT_BUBBLE_ICON,
  color: '#8b7bd8',
  background: '',
  preset: '',
  audience: 'all',
  enabled: true,
  starts_at: null,
  ends_at: null,
  delay_seconds: 0,
  duration_minutes: 60,
  dismissible: true,
  reshow_hours: 24,
  position: 0,
}

// Starting points: pick one, then change whatever you like.
const PRESETS: { key: string; label: string; input: Partial<BubbleInput> }[] = [
  {
    key: 'suggest',
    label: 'Suggestions',
    input: { text: 'Got a wish for the site? Tell us', href: '/suggestions', icon: 'IoBulb', color: '#8b7bd8' },
  },
  {
    key: 'horizon',
    label: 'Join Horizon',
    input: { text: 'Make your name shine — join Horizon', href: '/horizon', icon: 'Horizon', color: '#f5a623', audience: 'no_horizon' },
  },
  {
    key: 'wes-anderson',
    label: 'Wes Anderson films',
    input: { text: 'A Wes Anderson night? Start with the films', href: '/search?q=Wes%20Anderson', icon: 'IoFilm', color: '#e8a33a' },
  },
  {
    key: 'bingo',
    label: 'Book bingo',
    input: { text: 'Fill a bingo card with your reads', href: '/bingo', icon: 'IoTrophy', color: '#4fd1c5' },
  },
  {
    key: 'challenges',
    label: 'Challenges',
    input: { text: 'Join a reading challenge', href: '/discover?tab=challenges', icon: 'IoFlame', color: '#e0627f' },
  },
]

// A date-time field wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (unix: number | null) => {
  if (!unix) return ''
  const d = new Date(unix * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (v: string): number | null => {
  if (!v) return null
  const ms = new Date(v).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}
const when = (unix: number | null) => (unix ? new Date(unix * 1000).toLocaleString() : null)

const AUDIENCE_LABEL: Record<BubbleAudience, string> = {
  all: 'Everyone',
  horizon: 'Horizon members only',
  no_horizon: 'Non-Horizon members only',
}

export default function BubblesAdmin() {
  const [bubbles, setBubbles] = useState<Bubble[] | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<BubbleInput>(EMPTY)
  const [customColor, setCustomColor] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const r = await listAllBubbles()
    if (r.ok) setBubbles(r.bubbles)
    else setError(r.error)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the list
    void load()
  }, [load])

  const patch = (p: Partial<BubbleInput>) => setDraft((d) => ({ ...d, ...p }))

  const startNew = (preset?: (typeof PRESETS)[number]) => {
    setEditing('new')
    setDraft({ ...EMPTY, ...(preset?.input ?? {}), preset: preset?.key ?? '', position: (bubbles?.length ?? 0) * 10 })
    setCustomColor(false)
    setError('')
    setNotice('')
  }
  const startEdit = (b: Bubble) => {
    const { id, ...input } = b
    void id
    setEditing(b.id)
    setDraft(input)
    setCustomColor(!SWATCHES.includes(b.color))
    setError('')
    setNotice('')
  }
  const cancel = () => {
    setEditing(null)
    setError('')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing === null) return
    setBusy(true)
    setError('')
    const r = await saveBubble(editing === 'new' ? null : editing, draft)
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setNotice(editing === 'new' ? 'Bubble created.' : 'Bubble saved.')
    setEditing(null)
    await load()
  }

  const toggle = async (b: Bubble) => {
    const { id, ...input } = b
    const r = await saveBubble(id, { ...input, enabled: !b.enabled })
    if (!r.ok) setError(r.error)
    else await load()
  }

  const remove = async (b: Bubble) => {
    if (!window.confirm(`Delete the bubble “${b.text}”?`)) return
    const r = await deleteBubble(b.id)
    if (!r.ok) setError(r.error)
    else {
      setNotice('Bubble deleted.')
      await load()
    }
  }

  const Icon = bubbleIcon(draft.icon)

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
        Bubbles are the message pills next to the feed greeting. Enabled ones take turns, one at a time, each holding the slot for its own
        number of minutes (an hour by default). Until you create the first one, the built-in “tell us your wishes” pill shows.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-emerald-500">{notice}</p>}

      {editing === null && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">New bubble</h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => startNew(p)}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--container)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
              >
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => startNew()} className="rounded-full bg-nonsprimary px-3 py-1.5 text-xs font-medium text-white hover:bg-nonsprimaryfocus">
              Blank
            </button>
          </div>
        </section>
      )}

      {editing !== null && (
        <form onSubmit={save} className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{editing === 'new' ? 'New bubble' : 'Edit bubble'}</h3>

          <div className="rounded-xl bg-[var(--container)] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Preview</p>
            <GreetingBubble
              text={draft.text || 'Your message'}
              href="#"
              icon={Icon}
              color={draft.color}
              background={draft.background || undefined}
            />
          </div>

          <label className={LABEL}>
            Text ({draft.text.length}/140)
            <input value={draft.text} maxLength={140} onChange={(e) => patch({ text: e.target.value })} className={INPUT} required />
          </label>
          <label className={LABEL}>
            Link — an in-app path like /bingo, or a full https:// URL
            <input value={draft.href} onChange={(e) => patch({ href: e.target.value })} className={INPUT} required />
          </label>

          <div className={LABEL}>
            Icon
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] p-2">
              {Object.entries(BUBBLE_ICONS).map(([name, I]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => patch({ icon: name })}
                  aria-label={name}
                  title={name}
                  aria-pressed={draft.icon === name}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    draft.icon === name ? 'border-nonsprimary bg-[var(--primary-soft)] text-nonsprimary' : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                  }`}
                >
                  <I className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          <div className={LABEL}>
            Colour
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    patch({ color: c })
                    setCustomColor(false)
                  }}
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  className={`h-7 w-7 rounded-full border-2 ${draft.color === c ? 'border-white' : 'border-white/20'}`}
                  style={{ background: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => setCustomColor((v) => !v)}
                aria-expanded={customColor}
                className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text)] hover:border-nonsprimary"
              >
                Custom…
              </button>
            </div>
            {customColor && (
              <div className="mt-2">
                <ColorPicker color={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#8b7bd8'} onChange={(hex) => patch({ color: hex })} />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Shown to
              <select value={draft.audience} onChange={(e) => patch({ audience: e.target.value as BubbleAudience })} className={INPUT}>
                {(Object.keys(AUDIENCE_LABEL) as BubbleAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Order in the rotation (low first)
              <input type="number" value={draft.position} onChange={(e) => patch({ position: Number(e.target.value) || 0 })} className={INPUT} />
            </label>
            <label className={LABEL}>
              Holds the slot for (minutes)
              <input type="number" min={1} max={1440} value={draft.duration_minutes} onChange={(e) => patch({ duration_minutes: Number(e.target.value) || 60 })} className={INPUT} />
            </label>
            <label className={LABEL}>
              Appears after (seconds on the page)
              <input type="number" min={0} max={3600} value={draft.delay_seconds} onChange={(e) => patch({ delay_seconds: Number(e.target.value) || 0 })} className={INPUT} />
            </label>
            <label className={LABEL}>
              Starts (optional)
              <input type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(e) => patch({ starts_at: fromLocalInput(e.target.value) })} className={INPUT} />
            </label>
            <label className={LABEL}>
              Ends (optional)
              <input type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(e) => patch({ ends_at: fromLocalInput(e.target.value) })} className={INPUT} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--text)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4 accent-nonsprimary" />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.dismissible} onChange={(e) => patch({ dismissible: e.target.checked })} className="h-4 w-4 accent-nonsprimary" />
              Can be closed
            </label>
            {draft.dismissible && (
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                comes back after
                <input
                  type="number"
                  min={0}
                  max={2160}
                  value={draft.reshow_hours}
                  onChange={(e) => patch({ reshow_hours: Number(e.target.value) || 0 })}
                  className={`${INPUT} h-8 w-20`}
                />
                hours (0 = never)
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${BTN} bg-nonsprimary text-white hover:bg-nonsprimaryfocus`}>
              {busy ? '…' : 'Save'}
            </button>
            <button type="button" onClick={cancel} className={`${BTN} text-[var(--text-muted)] hover:text-[var(--text)]`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">All bubbles</h3>
        {bubbles === null ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : bubbles.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">None yet — the built-in pill is showing. Pick a preset above to start.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {bubbles.map((b) => (
              <li key={b.id} className={`flex flex-col gap-2 py-3 ${b.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <GreetingBubble text={b.text} href="#" icon={bubbleIcon(b.icon)} color={b.color} background={b.background || undefined} />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button type="button" onClick={() => void toggle(b)} className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--container)] hover:text-[var(--text)]">
                      {b.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" onClick={() => startEdit(b)} aria-label="Edit" title="Edit" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--container)] hover:text-[var(--text)]">
                      <IoPencilOutline className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void remove(b)} aria-label="Delete" title="Delete" className="rounded-lg p-1.5 text-red-400 hover:bg-[var(--container)]">
                      <IoTrashOutline className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {b.href} · {AUDIENCE_LABEL[b.audience]} · {b.duration_minutes} min · order {b.position}
                  {b.delay_seconds > 0 ? ` · after ${b.delay_seconds}s` : ''}
                  {when(b.starts_at) ? ` · from ${when(b.starts_at)}` : ''}
                  {when(b.ends_at) ? ` · until ${when(b.ends_at)}` : ''}
                  {!b.dismissible ? ' · can’t be closed' : ''}
                  {!b.enabled ? ' · disabled' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
