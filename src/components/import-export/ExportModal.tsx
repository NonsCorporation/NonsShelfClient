import { useState } from 'react'
import { IoDownloadOutline, IoClose, IoChevronDown, IoChevronUp } from 'react-icons/io5'
import { authedFetch } from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Collection } from '@/types'
import DatePicker from '@/components/ui/DatePicker'

interface Props {
  collections: Collection[]
  onClose: () => void
}

type Format = 'csv' | 'json'
type MediaType = 'all' | 'book' | 'movie' | 'series'

const ALL_STATUSES = ['wishlist', 'active', 'done', 'dnf'] as const
type StatusKey = (typeof ALL_STATUSES)[number]

// Core fields — always exported, checkbox disabled, but column name is editable.
const CORE_FIELDS = [
  { key: 'title',  labelKey: 'exportFieldTitle' },
  { key: 'type',   labelKey: 'exportFieldType' },
  { key: 'status', labelKey: 'exportFieldStatus' },
]

// Optional fields in canonical order, grouped for display.
const FIELD_GROUPS = [
  {
    labelKey: 'exportGroupBasic',
    fields: [
      { key: 'original_title', labelKey: 'exportFieldOriginalTitle' },
      { key: 'author',         labelKey: 'exportFieldAuthor' },
      { key: 'year',           labelKey: 'exportFieldYear' },
      { key: 'genre',          labelKey: 'exportFieldGenre' },
    ],
  },
  {
    labelKey: 'exportGroupDates',
    fields: [
      { key: 'started_at',  labelKey: 'exportFieldStartedAt' },
      { key: 'finished_at', labelKey: 'exportFieldFinishedAt' },
      { key: 'added_at',    labelKey: 'exportFieldAddedAt' },
    ],
  },
  {
    labelKey: 'exportGroupPersonal',
    fields: [
      { key: 'rating',      labelKey: 'exportFieldRating' },
      { key: 'review',      labelKey: 'exportFieldReview' },
      { key: 'collections', labelKey: 'exportFieldCollections' },
      { key: 'favorite',    labelKey: 'exportFieldFavorite' },
    ],
  },
  {
    labelKey: 'exportGroupBooks',
    fields: [
      { key: 'pages',     labelKey: 'exportFieldPages' },
      { key: 'isbn',      labelKey: 'exportFieldISBN' },
      { key: 'language',  labelKey: 'exportFieldLanguage' },
      { key: 'publisher', labelKey: 'exportFieldPublisher' },
    ],
  },
  {
    labelKey: 'exportGroupMedia',
    fields: [
      { key: 'duration_min', labelKey: 'exportFieldDuration' },
    ],
  },
]

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key))
const ALL_COL_KEYS   = [...CORE_FIELDS.map((f) => f.key), ...ALL_FIELD_KEYS]

export default function ExportModal({ collections, onClose }: Props) {
  const { t } = useLanguage()
  const [format, setFormat]         = useState<Format>('csv')
  const [mediaType, setMediaType]   = useState<MediaType>('all')
  const [statuses, setStatuses]     = useState<Set<StatusKey>>(new Set(ALL_STATUSES))
  const [collectionId, setCollectionId] = useState<string>('')
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const [fields, setFields]         = useState<Set<string>>(new Set(ALL_FIELD_KEYS))
  const [colNames, setColNames]     = useState<Record<string, string>>(
    () => Object.fromEntries(ALL_COL_KEYS.map((k) => [k, k]))
  )
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [loading, setLoading]       = useState(false)

  function toggleStatus(s: StatusKey) {
    setStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) {
        if (next.size === 1) return prev
        next.delete(s)
      } else {
        next.add(s)
      }
      return next
    })
  }

  function toggleField(key: string) {
    setFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function setAllFields(all: boolean) {
    setFields(all ? new Set(ALL_FIELD_KEYS) : new Set([ALL_FIELD_KEYS[0]]))
  }

  async function doExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ format })
      if (mediaType !== 'all') params.set('type', mediaType)
      if (statuses.size < ALL_STATUSES.length) params.set('status', [...statuses].join(','))
      if (collectionId) params.set('collection_id', collectionId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (fields.size < ALL_FIELD_KEYS.length) params.set('fields', [...fields].join(','))
      // Send renames for core fields and any renamed optional field.
      for (const key of ALL_COL_KEYS) {
        const trimmed = (colNames[key] ?? key).trim()
        if (trimmed && trimmed !== key) params.set(`rename_${key}`, trimmed)
      }

      const res = await authedFetch(`/api/export?${params}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `nons-library-export.${format}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch {
      // user can retry
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--input)] px-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

  const toggleBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? 'bg-nonsprimary text-white'
        : 'border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
    }`

  const statusLabels: Record<StatusKey, string> = {
    wishlist: t('shelfWishlist'),
    active:   t('shelfActive'),
    done:     t('shelfDone'),
    dnf:      t('shelfDNF'),
  }

  const allSelected = fields.size === ALL_FIELD_KEYS.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col rounded-2xl border border-[var(--border)] bg-[var(--container)] shadow-xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <IoDownloadOutline className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text)]">{t('exportLibrary')}</span>
          </div>
          <button onClick={onClose} className="rounded text-[var(--text-muted)] hover:text-[var(--text)]">
            <IoClose className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-1">
          <div className="flex flex-col gap-4">

            {/* Format */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {t('exportFormat')}
              </p>
              <div className="flex gap-2">
                <button className={toggleBtn(format === 'csv')}  onClick={() => setFormat('csv')}>CSV</button>
                <button className={toggleBtn(format === 'json')} onClick={() => setFormat('json')}>JSON</button>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {format === 'csv' ? t('exportCsvHint') : t('exportJsonHint')}
              </p>
            </div>

            {/* Type */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {t('exportType')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'book', 'movie', 'series'] as MediaType[]).map((k) => (
                  <button key={k} className={toggleBtn(mediaType === k)} onClick={() => setMediaType(k)}>
                    {k === 'all' ? t('allItems') : t(k)}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {t('exportStatus')}
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map((s) => (
                  <button key={s} className={toggleBtn(statuses.has(s))} onClick={() => toggleStatus(s)}>
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Collection */}
            {collections.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {t('exportCollection')}
                </p>
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className={inputCls + ' w-full'}
                >
                  <option value="">{t('allCollections')}</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Finished date range */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {t('exportFinishedRange')}
              </p>
              <div className="flex items-center gap-2">
                <DatePicker value={from} onChange={setFrom} max={to || undefined} />
                <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">—</span>
                <DatePicker value={to} onChange={setTo} min={from || undefined} />
              </div>
            </div>

            {/* Fields — collapsible */}
            <div className="rounded-xl border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setFieldsOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
              >
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    {t('exportFields')}
                  </span>
                  <span className="ml-2 text-[11px] text-[var(--text-muted)]">
                    {fields.size} / {ALL_FIELD_KEYS.length}
                  </span>
                </div>
                {fieldsOpen
                  ? <IoChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  : <IoChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
              </button>

              {fieldsOpen && (
                <div className="border-t border-[var(--border-subtle)]">
                  {/* Select all / none */}
                  <div className="flex gap-3 px-3.5 py-2 border-b border-[var(--border-subtle)]">
                    <button
                      onClick={() => setAllFields(true)}
                      className={`text-[11px] font-medium transition-colors ${allSelected ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                    >
                      {t('exportSelectAll')}
                    </button>
                    <span className="text-[var(--border)]">·</span>
                    <button
                      onClick={() => setAllFields(false)}
                      className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {t('exportSelectNone')}
                    </button>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3.5 py-1.5 border-b border-[var(--border-subtle)]">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t('exportColField')}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t('exportColKey')}</span>
                    <span />
                  </div>

                  {/* Core fields — always included, checkbox locked */}
                  <div>
                    <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                      {t('exportGroupCore')}
                    </p>
                    {CORE_FIELDS.map((f, fi) => {
                      const isLast = fi === CORE_FIELDS.length - 1
                      return (
                        <div
                          key={f.key}
                          className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3.5 py-1.5 ${!isLast ? 'border-b border-[var(--border-subtle)]/50' : ''}`}
                        >
                          <span className="text-sm text-[var(--text)]">{t(f.labelKey)}</span>
                          <input
                            type="text"
                            value={colNames[f.key] ?? f.key}
                            onChange={(e) => setColNames((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            onBlur={(e) => { if (!e.target.value.trim()) setColNames((prev) => ({ ...prev, [f.key]: f.key })) }}
                            className="w-32 rounded-md border border-transparent bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-subtle)] focus:border-[var(--primary-ring)] focus:text-[var(--text)] focus:outline-none"
                          />
                          <input
                            type="checkbox"
                            checked
                            disabled
                            className="h-4 w-4 rounded border-[var(--border-subtle)] opacity-40"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Optional fields grouped by category */}
                  {FIELD_GROUPS.map((group, gi) => (
                    <div key={group.labelKey}>
                      <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                        {t(group.labelKey)}
                      </p>
                      {group.fields.map((f, fi) => {
                        const checked = fields.has(f.key)
                        const isLast = gi === FIELD_GROUPS.length - 1 && fi === group.fields.length - 1
                        return (
                          <label
                            key={f.key}
                            className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3.5 py-1.5 transition-colors hover:bg-[var(--surface-hover)] ${!isLast ? 'border-b border-[var(--border-subtle)]/50' : ''}`}
                          >
                            <span className={`text-sm ${checked ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                              {t(f.labelKey)}
                            </span>
                            <input
                              type="text"
                              value={colNames[f.key] ?? f.key}
                              onChange={(e) => setColNames((prev) => ({ ...prev, [f.key]: e.target.value }))}
                              onBlur={(e) => {
                                if (!e.target.value.trim())
                                  setColNames((prev) => ({ ...prev, [f.key]: f.key }))
                              }}
                              onClick={(e) => e.preventDefault()}
                              className="w-32 rounded-md border border-transparent bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-subtle)] focus:border-[var(--primary-ring)] focus:text-[var(--text)] focus:outline-none"
                            />
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleField(f.key)}
                              className="h-4 w-4 cursor-pointer rounded border-[var(--border-subtle)] accent-[var(--primary)]"
                            />
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-2 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </button>
          <button
            onClick={doExport}
            disabled={loading || statuses.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <IoDownloadOutline className="h-4 w-4" />
            {loading ? t('exporting') : t('exportDownload')}
          </button>
        </div>
      </div>
    </div>
  )
}
