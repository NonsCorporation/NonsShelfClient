'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  IoArrowUp,
  IoArrowDown,
  IoTrashOutline,
  IoAdd,
  IoSearch,
  IoClose,
} from 'react-icons/io5'
import { connectionService } from '@/services/connectionService'
import { catalogService, type CatalogItem } from '@/services/catalogService'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Franchise, FranchiseRef, SeriesPageData } from '@/types'

const SERIES_ROLES = ['', 'main', 'spinoff', 'prequel', 'sequel', 'interquel']

// Self-contained editor for a whole series: its metadata (name, description,
// role, franchise), and its ordered entries (reorder, edit position/label,
// add/remove works). Fetches its own data by uuid, so it can be dropped on the
// series page OR inline in the edit-media connections panel. Calls onChanged
// after every mutation so a host can refresh its own view.
export default function SeriesEditor({
  uuid,
  onChanged,
  onDeleted,
}: {
  uuid: string
  onChanged?: () => void
  onDeleted?: () => void
}) {
  const { t } = useLanguage()
  const [data, setData] = useState<SeriesPageData | null>(null)

  const reload = useCallback(async () => {
    const d = await connectionService.getSeries(uuid)
    setData(d)
    onChanged?.()
  }, [uuid, onChanged])

  useEffect(() => {
    let cancelled = false
    connectionService.getSeries(uuid).then((d) => { if (!cancelled) setData(d) })
    return () => { cancelled = true }
  }, [uuid])

  if (!data) {
    return <p className="py-4 text-sm text-[var(--text-muted)]">{t('loading')}</p>
  }

  const { series, items, franchise } = data
  return <Editor series={series} items={items} franchise={franchise} reload={reload} onDeleted={onDeleted} />
}

function Editor({
  series,
  items,
  franchise,
  reload,
  onDeleted,
}: {
  series: SeriesPageData['series']
  items: SeriesPageData['items']
  franchise?: FranchiseRef
  reload: () => Promise<void>
  onDeleted?: () => void
}) {
  const { t } = useLanguage()
  const uuid = series.uuid

  const [name, setName] = useState(series.name)
  const [description, setDescription] = useState(series.description || '')
  const [role, setRole] = useState(series.role || '')
  const [franchiseId, setFranchiseId] = useState<number | null>(series.franchise_id ?? null)
  const [franchiseName, setFranchiseName] = useState(franchise?.name ?? '')
  const [savingMeta, setSavingMeta] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Re-sync the form when the underlying series changes (e.g. after a reload).
  useEffect(() => {
    setName(series.name)
    setDescription(series.description || '')
    setRole(series.role || '')
    setFranchiseId(series.franchise_id ?? null)
    setFranchiseName(franchise?.name ?? '')
  }, [series.name, series.description, series.role, series.franchise_id, franchise?.name])

  const saveMeta = async () => {
    setSavingMeta(true)
    try {
      await connectionService.updateSeries(uuid, {
        name: name.trim() || series.name,
        type: series.type,
        description: description.trim() || undefined,
        role: role || undefined,
        franchise_id: franchiseId,
        parent_series_id: series.parent_series_id ?? null,
      })
      await reload()
    } finally {
      setSavingMeta(false)
    }
  }

  const swap = async (i: number, j: number) => {
    if (j < 0 || j >= items.length) return
    const a = items[i], b = items[j]
    await Promise.all([
      connectionService.setSeriesItem(uuid, { media_id: a.media.id, position: b.position, label: a.label || undefined }),
      connectionService.setSeriesItem(uuid, { media_id: b.media.id, position: a.position, label: b.label || undefined }),
    ])
    await reload()
  }

  const setItem = async (mediaId: number, position: number, label: string) => {
    await connectionService.setSeriesItem(uuid, { media_id: mediaId, position, label: label || undefined })
    await reload()
  }

  const remove = async (mediaId: number) => {
    await connectionService.removeSeriesItem(uuid, mediaId)
    await reload()
  }

  const del = async () => {
    await connectionService.deleteSeries(uuid)
    onDeleted?.()
  }

  const input = 'h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return (
    <div className="flex flex-col gap-4">
      {/* Metadata */}
      <div className="flex flex-col gap-3">
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('seriesName') || 'Series name'} />
        <textarea
          rows={3}
          className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('seriesDescription') || 'Description'}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {t('seriesRole') || 'Role'}
            <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
              {SERIES_ROLES.map((r) => <option key={r} value={r}>{r || '—'}</option>)}
            </select>
          </label>
          <FranchiseAttach
            franchiseId={franchiseId}
            franchiseName={franchiseName}
            onPick={(f) => { setFranchiseId(f?.id ?? null); setFranchiseName(f?.name ?? '') }}
          />
        </div>
        <button
          onClick={saveMeta}
          disabled={savingMeta}
          className="w-fit rounded-lg bg-nonsprimary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
        >
          {savingMeta ? (t('saving') || 'Saving…') : (t('saveChanges') || 'Save changes')}
        </button>
      </div>

      {/* Items */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('seriesEntries', { n: items.length })}
        </p>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <ItemRow
              key={it.media.id}
              index={i}
              count={items.length}
              position={it.position}
              label={it.label || ''}
              title={it.media.title}
              cover={it.media.cover_url}
              onUp={() => swap(i, i - 1)}
              onDown={() => swap(i, i + 1)}
              onSave={(pos, label) => setItem(it.media.id, pos, label)}
              onRemove={() => remove(it.media.id)}
            />
          ))}
          {items.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t('noEntriesYet') || 'No entries yet.'}</p>}
        </div>

        <div className="mt-3">
          <AddWork
            seriesType={series.type}
            existingIds={items.map((it) => it.media.id)}
            nextPosition={items.length ? Math.max(...items.map((it) => it.position)) + 1 : 1}
            onAdd={(mediaId, position) => setItem(mediaId, position, '')}
          />
        </div>
      </div>

      {/* Delete */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <IoTrashOutline className="h-4 w-4" />
            {t('deleteSeries') || 'Delete series'}
          </button>
        ) : (
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">{t('deleteSeriesConfirm') || 'Delete this series? The works stay in your catalog — only the series grouping is removed.'}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">{t('cancel')}</button>
              <button onClick={del} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20">{t('delete')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// One editable entry: reorder arrows, position + label inputs, remove.
function ItemRow({
  index, count, position, label, title, cover, onUp, onDown, onSave, onRemove,
}: {
  index: number
  count: number
  position: number
  label: string
  title: string
  cover?: string
  onUp: () => void
  onDown: () => void
  onSave: (position: number, label: string) => void
  onRemove: () => void
}) {
  const { t } = useLanguage()
  const [pos, setPos] = useState(String(position))
  const [lab, setLab] = useState(label)
  useEffect(() => { setPos(String(position)); setLab(label) }, [position, label])

  const dirty = pos !== String(position) || lab !== label
  const commit = () => { if (dirty) onSave(parseFloat(pos) || 0, lab.trim()) }
  const inp = 'h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2">
      <div className="flex flex-shrink-0 flex-col">
        <button onClick={onUp} disabled={index === 0} className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"><IoArrowUp className="h-4 w-4" /></button>
        <button onClick={onDown} disabled={index === count - 1} className="text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30"><IoArrowDown className="h-4 w-4" /></button>
      </div>
      <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{title}</p>
      <input className={`${inp} w-14`} type="number" step="0.5" value={pos} onChange={(e) => setPos(e.target.value)} onBlur={commit} title={t('position') || 'Position'} />
      <input className={`${inp} w-20`} value={lab} onChange={(e) => setLab(e.target.value)} onBlur={commit} placeholder={t('labelOptional') || 'Label'} />
      <button onClick={onRemove} title={t('removeLabel') || 'Remove'} className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500">
        <IoTrashOutline className="h-4 w-4" />
      </button>
    </div>
  )
}

// Attach / detach a franchise by searching or creating one.
function FranchiseAttach({ franchiseId, franchiseName, onPick }: {
  franchiseId: number | null
  franchiseName: string
  onPick: (f: Franchise | null) => void
}) {
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

  if (franchiseId) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]">
        {franchiseName || (t('franchiseTitle') || 'Universe')}
        <button onClick={() => onPick(null)} className="text-[var(--text-muted)] hover:text-red-500"><IoClose className="h-3.5 w-3.5" /></button>
      </span>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('attachFranchise') || 'Attach a universe'}
          className="h-10 w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {(results.length > 0 || (term && !exact)) && (
        <div className="absolute z-10 mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--container)] p-1 shadow-xl">
          {results.map((f) => (
            <button key={f.id} onClick={() => { onPick(f); setQ('') }} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">{f.name}</button>
          ))}
          {term && !exact && (
            <button
              onClick={async () => { const f = await connectionService.createFranchise({ name: term }); onPick(f); setQ('') }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-nonsprimary hover:bg-[var(--surface-hover)]"
            >
              <IoAdd className="h-4 w-4" />
              {t('createFranchiseNamed', { name: term }) || `Create "${term}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Catalog search to add a work into the series.
function AddWork({ seriesType, existingIds, nextPosition, onAdd }: {
  seriesType: SeriesPageData['series']['type']
  existingIds: number[]
  nextPosition: number
  onAdd: (mediaId: number, position: number) => void
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const timer = setTimeout(
      () => catalogService.getCatalog(q).then((d) => setResults(d.filter((m) => m.type === seriesType && !existingIds.includes(Number(m.id))))).catch(() => setResults([])),
      300,
    )
    return () => clearTimeout(timer)
  }, [q, seriesType, existingIds])

  return (
    <div>
      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('addWork') || 'Add a work to this series'}
          className="h-10 w-full rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-solid focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {results.map((m) => (
            <button
              key={m.id}
              onClick={() => { onAdd(Number(m.id), nextPosition); setQ(''); setResults([]) }}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:border-nonsprimary/50"
            >
              <div className="h-9 w-6 flex-shrink-0 overflow-hidden rounded bg-[var(--container-2)]">
                {m.coverUrl && <img src={m.coverUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text)]">{m.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{[m.author || m.director, m.year || undefined].filter(Boolean).join(' · ')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
