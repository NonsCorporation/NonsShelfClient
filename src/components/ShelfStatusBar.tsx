'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { IoChevronDown, IoCheckmark, IoAdd, IoTrendingUpOutline, IoClose } from 'react-icons/io5'
import type { MediaItem, ShelfStatus } from '../types'
import { STATUS_COLOR, statusLabel } from '../lib/shelf'
import { useLanguage } from '../contexts/LanguageContext'
import { useCollections } from '../contexts/CollectionContext'
import { collectionService } from '../services/collectionService'
import { libraryService } from '../services/libraryService'

type Props = {
  item: MediaItem
  currentStatus: ShelfStatus | null
  onStatusChange: (status: ShelfStatus) => void
  onEditProgress?: () => void
  variant?: 'bar' | 'button'
}

export default function ShelfStatusBar({ item, currentStatus, onStatusChange, onEditProgress, variant = 'bar' }: Props) {
  const { t } = useLanguage()
  const { collections, createCollection, refresh } = useCollections()
  const isBook = item.type === 'book'

  // enriches the status label with the latest progress for active items
  const [latestPage, setLatestPage] = useState<number>(0)
  const [episodeStats, setEpisodeStats] = useState<{ watched: number; total: number } | null>(null)
  
  useEffect(() => {
    if (currentStatus !== 'active') { setLatestPage(0); setEpisodeStats(null); return }
    if (isBook) {
      libraryService.getProgress(item.id).then((rows) => setLatestPage(rows[0]?.page ?? 0)).catch(() => {})
    } else if (item.type === 'series') {
      libraryService.getEpisodeStats(item.id).then(setEpisodeStats).catch(() => {})
    }
  }, [item.id, item.type, currentStatus, isBook])

  const statusOptions: { key: ShelfStatus; label: string }[] = [
    { key: 'wishlist', label: isBook ? 'Want to read' : 'Want to watch' },
    { key: 'active',   label: isBook ? 'Reading' : 'Watching' },
    { key: 'done',     label: isBook ? 'Already read' : 'Already watched' },
    { key: 'dnf',      label: 'Did not finish' },
  ]

  // switches the popover to a bottom-sheet modal on small screens
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setIsMobile(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const onShelf = currentStatus !== null
  const accent = onShelf ? STATUS_COLOR[currentStatus] : 'var(--text-muted)'
  const baseLabel = onShelf
    ? statusOptions.find((o) => o.key === currentStatus)?.label ?? statusLabel(item.type, currentStatus, t)
    : t('addToShelf')
  const currentLabel = (() => {
    if (currentStatus !== 'active') return baseLabel
    if (isBook && latestPage > 0) {
      const total = item.pages ?? 0
      return total > 0 ? `${baseLabel} (page ${latestPage}/${total})` : `${baseLabel} (page ${latestPage})`
    }
    if (item.type === 'series' && episodeStats && episodeStats.watched > 0) {
      const { watched, total } = episodeStats
      return total > 0 ? `${baseLabel} (ep ${watched}/${total})` : `${baseLabel} (ep ${watched})`
    }
    return baseLabel
  })()

  // tracks which user collections contain this item
  const [itemCollectionIds, setItemCollectionIds] = useState<number[]>(item.collectionIds ?? [])
  const [colLoading, setColLoading] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)

  // holds state for the inline new-collection form
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  // syncs local state when the item's collectionids prop changes
  useEffect(() => {
    setItemCollectionIds(item.collectionIds ?? [])
  }, [item.collectionIds])

  const handleToggle = () => {
    if (anchor) { setAnchor(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const extraWidth = onEditProgress ? 36 : 0
    setAnchor({ top: r.bottom + 6, left: r.left, width: Math.max(r.width + extraWidth, 260) })
    
    // lazily fetches collections containing this item
    setColLoading(true)
    collectionService.getItemCollections(item.id).then((ids) => {
      setItemCollectionIds(ids)
      setColLoading(false)
    }).catch(() => setColLoading(false))
  }

  useEffect(() => {
    if (!anchor) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-shelf-popover]')) setAnchor(null)
    }
    const closeOnScroll = () => setAnchor(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, { capture: true })
    }
  }, [anchor])

  useEffect(() => {
    if (creatingNew) setTimeout(() => newInputRef.current?.focus(), 30)
  }, [creatingNew])

  const handleStatus = (key: ShelfStatus) => {
    onStatusChange(key)
    setAnchor(null)
  }

  const toggleCollection = async (id: number) => {
    const next = itemCollectionIds.includes(id)
      ? itemCollectionIds.filter((c) => c !== id)
      : [...itemCollectionIds, id]
    setItemCollectionIds(next)
    await collectionService.setItemCollections(item.id, next)
    
    // updates the collection count in the sidebar
    refresh()
  }

  const handleCreateNew = async () => {
    const name = newName.trim()
    if (!name) return
    const col = await createCollection(name)
    setNewName('')
    setCreatingNew(false)
    
    // automatically adds the item to the newly created collection
    const next = [...itemCollectionIds, col.id]
    setItemCollectionIds(next)
    await collectionService.setItemCollections(item.id, next)
  }

  const popoverBody = (
    <>
      {/* renders the shelf status options */}
      <div className="flex flex-wrap gap-1.5">
        {statusOptions.map((opt) => {
          const color = STATUS_COLOR[opt.key]
          const isCurrent = onShelf && opt.key === currentStatus
          return (
            <button
              key={opt.key}
              onClick={() => handleStatus(opt.key)}
              // sets pill colors dynamically based on status and active state
              style={{
                borderColor: color,
                color: color,
                backgroundColor: isCurrent ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
              }}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            >
              {isCurrent && <IoCheckmark className="h-3 w-3" />}
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* renders the collection list */}
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {t('collections') || 'Collections'}
        </p>

        {colLoading ? (
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-[var(--surface)]" />
            ))}
          </div>
        ) : collections.length === 0 && !creatingNew ? (
          <p className="text-xs text-[var(--text-muted)]">{t('noCollections') || 'No collections yet'}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {collections.map((col) => {
              const on = itemCollectionIds.includes(col.id)
              return (
                <button
                  key={col.id}
                  onClick={() => toggleCollection(col.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? 'border-transparent bg-nonsprimary/20 text-nonsprimary'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  {on ? <IoCheckmark className="h-3 w-3" /> : <IoAdd className="h-3 w-3" />}
                  {col.name}
                </button>
              )
            })}
          </div>
        )}

        {/* renders the inline form to create a new collection */}
        {creatingNew ? (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateNew()
                if (e.key === 'Escape') { setCreatingNew(false); setNewName('') }
              }}
              placeholder={t('collectionName') || 'Collection name'}
              className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)]"
            />
            <button
              onClick={handleCreateNew}
              disabled={!newName.trim()}
              className="flex h-7 items-center rounded-lg bg-nonsprimary px-2.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {t('createCollection') || 'Create'}
            </button>
            <button
              onClick={() => { setCreatingNew(false); setNewName('') }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              <IoClose className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingNew(true)}
            className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <IoAdd className="h-3.5 w-3.5" />
            {t('newCollection') || 'New collection'}
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {variant === 'button' ? (
        // renders a prominent pill for standalone use
        <div ref={btnRef} className="inline-flex max-w-full">
          <button
            data-shelf-popover
            onClick={onShelf ? handleToggle : () => onStatusChange('wishlist')}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            {onShelf && <IoChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${anchor ? 'rotate-180' : ''}`} />}
            {!onShelf && <IoAdd className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />}
            <span className="truncate">{currentLabel}</span>
            {onShelf && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full border-[1.5px]" style={{ borderColor: accent }} />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div
            ref={btnRef}
            style={{ borderLeftColor: accent, color: accent }}
            className="flex min-w-0 flex-1 items-center rounded-r-lg border-l-[3px]"
          >
            <button
              data-shelf-popover
              onClick={onShelf ? handleToggle : () => onStatusChange('wishlist')}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium transition-opacity hover:opacity-70"
            >
              {!onShelf && <IoAdd className="h-3.5 w-3.5 flex-shrink-0" />}
              <span className="truncate">{currentLabel}</span>
            </button>
            <button
              data-shelf-popover
              onClick={handleToggle}
              aria-label={t('status') || 'Status'}
              className="flex flex-shrink-0 items-center py-1.5 pl-1 pr-2.5 transition-opacity hover:opacity-70"
            >
              <IoChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${anchor ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {onEditProgress && (
            <button
              onClick={onEditProgress}
              title={t('updateProgress') || 'Update progress'}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-nonsprimary"
            >
              <IoTrendingUpOutline className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {anchor && createPortal(
        isMobile ? (
          <div
            data-shelf-popover
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
            className="flex items-end bg-[var(--overlay)]"
            onClick={() => setAnchor(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-up flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-[var(--border)] bg-[var(--container)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--text)]">{t('status') || 'Status'}</span>
                <button
                  onClick={() => setAnchor(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"
                >
                  <IoClose className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{popoverBody}</div>
            </div>
          </div>
        ) : (
        <div
          data-shelf-popover
          style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width, zIndex: 60 }}
          className="animate-fade-up overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] shadow-2xl backdrop-blur-xl"
        >
          <div className="p-3">{popoverBody}</div>
        </div>
        ),
        document.body,
      )}
    </>
  )
}