'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  IoAdd,
  IoTrashOutline,
  IoSearch,
  IoLayersOutline,
  IoSparklesOutline,
  IoGitNetworkOutline,
  IoFlashOutline,
  IoChevronDown,
  IoChevronForward,
} from 'react-icons/io5'
import { Link } from '@/lib/router'
import { connectionService } from '@/services/connectionService'
import { catalogService, type CatalogItem } from '@/services/catalogService'
import SeriesEditor from '@/components/media/SeriesEditor'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSuggestion } from '@/contexts/SuggestionContext'
import type { Connections, Franchise, MediaItem, RelationKind, Series } from '@/types'

const SERIES_ROLES = ['main', 'spinoff', 'prequel', 'sequel', 'interquel']

// Librarian editor for a work's connections: its series membership, the
// universe it belongs to, and adaptation/remake links to other works. Reads the
// current state from the same /connections endpoint the public panel uses, then
// writes through the writer-guarded series/franchise/work-relation endpoints.
export default function ConnectionsManager({ item }: { item: MediaItem }) {
  const { t } = useLanguage()
  const { isSuggestionMode, suggest } = useSuggestion()
  const mediaId = Number(item.id)
  const mediaUuid = item.uuid ?? item.id
  const [conn, setConn] = useState<Connections | null>(null)

  const reload = useCallback(() => {
    connectionService.getConnections(item.id).then(setConn)
  }, [item.id])

  useEffect(() => { reload() }, [reload])

  const attachUniverse = async (f: Franchise) => {
    if (isSuggestionMode) {
      await suggest('add_franchise_member', mediaUuid, {
        franchise_id: f.id, franchise_uuid: f.uuid, franchise_name: f.name,
        media_id: mediaId, order: 0,
      }).catch(() => {})
      return
    }
    if (conn && conn.series.length > 0) {
      await Promise.all(conn.series.map(async (m) => {
        const d = await connectionService.getSeries(m.series.uuid)
        if (!d) return
        await connectionService.updateSeries(m.series.uuid, {
          name: d.series.name, type: d.series.type, description: d.series.description,
          role: d.series.role, franchise_id: f.id, parent_series_id: d.series.parent_series_id ?? null,
        })
      }))
    } else {
      await connectionService.setFranchiseMember(f.uuid, { media_id: mediaId, order: 0 })
    }
    reload()
  }

  const detachUniverse = async (franchiseUuid: string, franchiseName: string, franchiseId: number) => {
    if (isSuggestionMode) {
      await suggest('remove_franchise_member', mediaUuid, {
        franchise_id: franchiseId, franchise_name: franchiseName, media_id: mediaId,
      }).catch(() => {})
      return
    }
    await connectionService.removeFranchiseMember(franchiseUuid, mediaId).catch(() => {})
    if (conn) {
      await Promise.all(conn.series.map(async (m) => {
        const d = await connectionService.getSeries(m.series.uuid)
        if (!d || !d.series.franchise_id) return
        await connectionService.updateSeries(m.series.uuid, {
          name: d.series.name, type: d.series.type, description: d.series.description,
          role: d.series.role, franchise_id: null, parent_series_id: d.series.parent_series_id ?? null,
        })
      }))
    }
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Auto-find from TMDB (movies only) ── */}
      {item.type === 'movie' && <AutoFind item={item} onDone={reload} />}

      {/* ── Series membership ── */}
      <Group icon={<IoLayersOutline className="h-4 w-4 text-nonsprimary" />} title={t('seriesMembership') || 'Series'}>
        {conn?.series.map((m) => (
          <SeriesMembershipRow
            key={m.series.id}
            uuid={m.series.uuid}
            name={m.series.name}
            position={m.position}
            label={m.label}
            total={m.total}
            onRemove={() => {
              if (isSuggestionMode) {
                suggest('remove_series_item', mediaUuid, { series_id: m.series.id, series_name: m.series.name, media_id: mediaId }).catch(() => {})
              } else {
                connectionService.removeSeriesItem(m.series.uuid, mediaId).then(reload)
              }
            }}
            onChanged={reload}
          />
        ))}
        <SeriesAdder mediaId={mediaId} mediaUuid={mediaUuid} type={item.type} onDone={reload} />
      </Group>

      {/* ── Universe (groups whole series) ── */}
      <Group icon={<IoSparklesOutline className="h-4 w-4 text-nonsprimary" />} title={t('franchiseMembership') || 'Universe'}>
        {conn?.franchises.map((f) => (
          <Row key={f.franchise.id} onRemove={() => detachUniverse(f.franchise.uuid, f.franchise.name, f.franchise.id)}>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{f.franchise.name}</span>
            {f.saga && <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{f.saga}</span>}
          </Row>
        ))}
        <UniversePicker onPick={attachUniverse} />
        {conn && conn.series.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">{t('universeNeedsSeriesHint') || 'Tip: add this movie to a series first, so the whole series joins the universe.'}</p>
        )}
      </Group>

      {/* ── Adaptations & links ── */}
      <Group icon={<IoGitNetworkOutline className="h-4 w-4 text-nonsprimary" />} title={t('workRelations') || 'Adaptations & links'}>
        {conn?.relations.map((r) => (
          <Row
            key={r.id}
            onRemove={() => {
              if (isSuggestionMode) {
                suggest('delete_relation', `${mediaUuid}/${r.id}`, { kind: r.kind, other_title: r.media.title }).catch(() => {})
              } else {
                connectionService.deleteRelation(r.id).then(reload)
              }
            }}
          >
            <span className="flex-shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {r.kind}
              {r.direction === 'incoming' ? ' ←' : ' →'}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{r.media.title}</span>
            {typeof r.part === 'number' && r.part > 0 && (
              <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">Pt {r.part}</span>
            )}
          </Row>
        ))}
        <RelationAdder mediaId={mediaId} mediaUuid={mediaUuid} mediaType={item.type} onDone={reload} />
      </Group>
    </div>
  )
}

// ── Auto-find from TMDB ───────────────────────────────────────────────────────────
function AutoFind({ item, onDone }: { item: MediaItem; onDone: () => void }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; uuid?: string } | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true); setError(''); setResult(null)
    try {
      const sum = await connectionService.autoConnect(item.id)
      if (!sum.series) {
        setResult({ text: t('autoFoundNone') || 'Not part of a TMDB collection.' })
      } else {
        setResult({
          text: `${sum.series} — ${t('autoFoundResult', { linked: sum.linked, skipped: sum.skipped })}`,
          uuid: sum.series_uuid,
        })
        onDone()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text)]">{t('autoFindConnections') || 'Auto-find from TMDB'}</p>
          <p className="text-xs text-[var(--text-muted)]">{t('autoFindConnectionsHint') || 'Build this film series from its TMDB collection.'}</p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
        >
          <IoFlashOutline className="h-4 w-4" />
          {busy ? (t('autoFinding') || 'Finding…') : (t('autoFindConnections') || 'Auto-find')}
        </button>
      </div>
      {result && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {result.uuid ? (
            <Link to={`/series/${result.uuid}`} className="text-nonsprimary hover:underline">{result.text}</Link>
          ) : (
            result.text
          )}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ── layout helpers ──────────────────────────────────────────────────────────────

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{title}</h4>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
      {children}
      <button
        onClick={onRemove}
        title="Remove"
        className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
      >
        <IoTrashOutline className="h-4 w-4" />
      </button>
    </div>
  )
}

const inputCls =
  'h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2.5 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

// A series this work belongs to: shows its position, can be removed, and expands
// to the full series editor (reorder all entries, edit metadata, add/remove).
function SeriesMembershipRow({
  uuid, name, position, label, total, onRemove, onChanged,
}: {
  uuid: string
  name: string
  position: number
  label?: string
  total: number
  onRemove: () => void
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <IoChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" /> : <IoChevronForward className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />}
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{name}</span>
        </button>
        <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
          #{position}{label ? ` · ${label}` : ''} / {total}
        </span>
        <button onClick={onRemove} title={t('removeLabel') || 'Remove'} className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500">
          <IoTrashOutline className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="border-t border-[var(--border-subtle)] p-3">
          <SeriesEditor uuid={uuid} onChanged={onChanged} onDeleted={onChanged} />
        </div>
      )}
    </div>
  )
}

// ── Series adder: pick an existing series or create one, then set position ──────
function SeriesAdder({ mediaId, mediaUuid, type, onDone }: { mediaId: number; mediaUuid: string; type: MediaItem['type']; onDone: () => void }) {
  const { t } = useLanguage()
  const { isSuggestionMode, suggest } = useSuggestion()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Series[]>([])
  const [picked, setPicked] = useState<Series | null>(null)
  const [position, setPosition] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim() || picked) { setResults([]); return }
    const timer = setTimeout(() => connectionService.searchSeries(q).then(setResults).catch(() => setResults([])), 300)
    return () => clearTimeout(timer)
  }, [q, picked])

  const term = q.trim()
  const exact = results.some((s) => s.name.toLowerCase() === term.toLowerCase())

  const createAndPick = async () => {
    const s = await connectionService.createSeries({ name: term, type })
    setPicked(s)
    setResults([])
  }

  const submit = async () => {
    if (!picked) return
    setBusy(true)
    try {
      if (isSuggestionMode) {
        await suggest('add_series_item', mediaUuid, {
          series_id: picked.id, series_uuid: picked.uuid, series_name: picked.name,
          media_id: mediaId, position: parseFloat(position) || 0, label: label.trim() || '',
        })
      } else {
        await connectionService.setSeriesItem(picked.uuid, {
          media_id: mediaId, position: parseFloat(position) || 0, label: label.trim() || undefined,
        })
      }
      setPicked(null); setQ(''); setPosition(''); setLabel('')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  if (picked) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-2.5">
        <span className="text-sm font-medium text-[var(--text)]">{picked.name}</span>
        <input className={`${inputCls} w-24`} type="number" step="0.5" placeholder={t('position') || 'Position'} value={position} onChange={(e) => setPosition(e.target.value)} />
        <select className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)}>
          <option value="">{t('labelOptional') || 'Label (optional)'}</option>
          {SERIES_ROLES.filter((r) => r !== 'main').map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
          <IoAdd className="h-3.5 w-3.5" /> {t('add')}
        </button>
        <button onClick={() => { setPicked(null); setQ('') }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">{t('cancel')}</button>
      </div>
    )
  }

  return (
    <SearchBox q={q} setQ={setQ} placeholder={t('addToSeries') || 'Add to a series'}>
      {term && !exact && (
        <CreateRow label={t('createSeriesNamed', { name: term }) || `Create series "${term}"`} onClick={createAndPick} />
      )}
      {results.map((s) => (
        <PickRow key={s.id} title={s.name} subtitle={s.type} onClick={() => setPicked(s)} />
      ))}
    </SearchBox>
  )
}

// ── Universe picker ────────────────────────────────────────────────────────────
// Pick (or create) a universe. The parent decides what attaching means — here it
// attaches the movie's whole series to the universe. Creation is find-or-create
// by name on the server, so the same universe is never duplicated.
function UniversePicker({ onPick }: { onPick: (f: Franchise) => void }) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Franchise[]>([])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const timer = setTimeout(() => connectionService.searchFranchises(q).then(setResults).catch(() => setResults([])), 300)
    return () => clearTimeout(timer)
  }, [q])

  const term = q.trim()
  const exact = results.some((f) => f.name.toLowerCase() === term.toLowerCase())

  const choose = (f: Franchise) => { onPick(f); setQ(''); setResults([]) }
  const createAndChoose = async () => {
    const f = await connectionService.createFranchise({ name: term })
    choose(f)
  }

  return (
    <SearchBox q={q} setQ={setQ} placeholder={t('addToFranchise') || 'Add to a universe'}>
      {term && !exact && (
        <CreateRow label={t('createFranchiseNamed', { name: term }) || `Create universe "${term}"`} onClick={createAndChoose} />
      )}
      {results.map((f) => (
        <PickRow key={f.id} title={f.name} onClick={() => choose(f)} />
      ))}
    </SearchBox>
  )
}

// Directional relation choices. `swap` flips from/to so the edge is stored in
// its canonical direction (a book→film adaptation) no matter which side you're
// editing: on a film you pick "Based on / adapted from" → it stores book→film,
// which the panel then renders as "Based on" here and "Adaptations" on the book.
// So "based on" is just the reverse of "adaptation" — no separate DB kind.
type RelationChoice = { value: string; label: string; kind: RelationKind; swap: boolean }
const RELATION_CHOICES: RelationChoice[] = [
  { value: 'based_on', label: 'Based on / adapted from', kind: 'adaptation', swap: true },
  { value: 'adapted_into', label: 'Adapted into', kind: 'adaptation', swap: false },
  { value: 'novelization_of', label: 'Novelization of', kind: 'novelization', swap: true },
  { value: 'novelized_as', label: 'Novelized as', kind: 'novelization', swap: false },
  { value: 'remake', label: 'Remake / version of', kind: 'remake', swap: false },
  { value: 'companion', label: 'Companion to', kind: 'companion', swap: false },
  { value: 'crossover', label: 'Crossover with', kind: 'crossover', swap: false },
]

// ── Relation adder: pick a target work, choose a directional relation + part ─────
function RelationAdder({ mediaId, mediaUuid, mediaType, onDone }: { mediaId: number; mediaUuid: string; mediaType: MediaItem['type']; onDone: () => void }) {
  const { t } = useLanguage()
  const { isSuggestionMode, suggest } = useSuggestion()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [picked, setPicked] = useState<CatalogItem | null>(null)
  const [choice, setChoice] = useState<string>('based_on')
  const [part, setPart] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim() || picked) { setResults([]); return }
    const timer = setTimeout(
      () => catalogService.getCatalog(q).then((d) => setResults(d.filter((m) => m.id !== String(mediaId)))).catch(() => setResults([])),
      300,
    )
    return () => clearTimeout(timer)
  }, [q, picked, mediaId])

  const submit = async () => {
    if (!picked) return
    const c = RELATION_CHOICES.find((x) => x.value === choice) ?? RELATION_CHOICES[0]
    const other = Number(picked.id)
    const fromId = c.swap ? other : mediaId
    const toId = c.swap ? mediaId : other
    setBusy(true)
    try {
      if (isSuggestionMode) {
        await suggest('add_relation', mediaUuid, {
          from_media_id: fromId, to_media_id: toId, kind: c.kind,
          part: part ? parseInt(part, 10) : undefined, note: note.trim() || '',
          from_uuid: c.swap ? picked.uuid : mediaUuid,
          from_title: c.swap ? picked.title : undefined,
          from_type: c.swap ? picked.type : mediaType,
          to_uuid: c.swap ? mediaUuid : picked.uuid,
          to_title: c.swap ? undefined : picked.title,
          to_type: c.swap ? mediaType : picked.type,
          direction_label: c.label,
        })
      } else {
        await connectionService.createRelation({
          from_media_id: fromId, to_media_id: toId, kind: c.kind,
          part: part ? parseInt(part, 10) : undefined, note: note.trim() || undefined,
        })
      }
      setPicked(null); setQ(''); setChoice('based_on'); setPart(''); setNote('')
      onDone()
    } finally {
      setBusy(false)
    }
  }

  if (picked) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] p-2.5">
        <span className="min-w-0 max-w-[40%] truncate text-sm font-medium text-[var(--text)]">{picked.title}</span>
        <select className={inputCls} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {RELATION_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input className={`${inputCls} w-16`} type="number" placeholder={t('partLabel') || 'Part'} value={part} onChange={(e) => setPart(e.target.value)} />
        <input className={`${inputCls} w-36`} placeholder={t('noteOptional') || 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-nonsprimary px-3 py-1.5 text-xs font-semibold text-white hover:bg-nonsprimaryfocus disabled:opacity-50">
          <IoAdd className="h-3.5 w-3.5" /> {t('add')}
        </button>
        <button onClick={() => { setPicked(null); setQ('') }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">{t('cancel')}</button>
      </div>
    )
  }

  return (
    <SearchBox q={q} setQ={setQ} placeholder={t('linkWork') || 'Link a work'}>
      {results.map((m) => (
        <PickRow
          key={m.id}
          title={m.title}
          subtitle={[m.type, m.year || undefined].filter(Boolean).join(' · ')}
          cover={m.coverUrl}
          onClick={() => setPicked(m)}
        />
      ))}
    </SearchBox>
  )
}

// ── small shared search UI ───────────────────────────────────────────────────────
function SearchBox({
  q, setQ, placeholder, children,
}: { q: string; setQ: (s: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-solid focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {(Array.isArray(children) ? children.some(Boolean) : children) && (
        <div className="mt-1.5 flex flex-col gap-1">{children}</div>
      )}
    </div>
  )
}

function PickRow({ title, subtitle, cover, onClick }: { title: string; subtitle?: string; cover?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-nonsprimary/50"
    >
      {cover !== undefined && (
        <div className="h-9 w-6 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--text)]">{title}</p>
        {subtitle && <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>}
      </div>
    </button>
  )
}

function CreateRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
    >
      <IoAdd className="h-4 w-4 text-nonsprimary" />
      {label}
    </button>
  )
}
