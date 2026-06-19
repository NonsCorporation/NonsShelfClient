'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { IoChevronDown, IoCheckmark, IoAdd, IoTrendingUpOutline } from 'react-icons/io5'
import type { MediaItem, ShelfStatus } from '../types'
import { STATUS_COLOR, statusLabel } from '../lib/shelf'
import { useLanguage } from '../contexts/LanguageContext'

const MOCK_COLLECTIONS = ['Recommended', 'Best of 2024', 'Must Read', 'To Share', 'Rewatched']

type Props = {
  item: MediaItem
  /** The shelf status, or null when the item isn't on the user's shelf yet. */
  currentStatus: ShelfStatus | null
  onStatusChange: (status: ShelfStatus) => void
  /** When provided, shows the edit-progress icon button. Only relevant when active. */
  onEditProgress?: () => void
}

export default function ShelfStatusBar({ item, currentStatus, onStatusChange, onEditProgress }: Props) {
  const { t } = useLanguage()
  const isBook = item.type === 'book'

  const statusOptions: { key: ShelfStatus; label: string }[] = [
    { key: 'wishlist', label: isBook ? 'Want to read' : 'Want to watch' },
    { key: 'active',   label: isBook ? 'Reading' : 'Watching' },
    { key: 'done',     label: isBook ? 'Already read' : 'Already watched' },
  ]

  // Not on the shelf yet: show a neutral "Add to shelf" affordance instead of a
  // status that looks pre-selected. Picking any option adds it to the shelf.
  const onShelf = currentStatus !== null
  const accent = onShelf ? STATUS_COLOR[currentStatus] : 'var(--text-muted)'
  const currentLabel = onShelf
    ? statusOptions.find((o) => o.key === currentStatus)?.label ?? statusLabel(item.type, currentStatus, t)
    : t('addToShelf')

  const [collections, setCollections] = useState<string[]>([])
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    if (anchor) { setAnchor(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const extraWidth = onEditProgress ? 36 : 0
    setAnchor({ top: r.bottom + 6, left: r.left, width: Math.max(r.width + extraWidth, 240) })
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

  const handleStatus = (key: ShelfStatus) => {
    onStatusChange(key)
    setAnchor(null)
  }

  const toggleCollection = (name: string) =>
    setCollections((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name])

  return (
    <>
      <div className="flex items-center gap-1">
        <div
          ref={btnRef}
          style={{ borderLeftColor: accent, color: accent }}
          className="flex min-w-0 flex-1 items-center rounded-r-lg border-l-[3px]"
        >
          {/* Main area: when unshelved, one click shelves it as "Want to…";
              when already on a shelf it just opens the status menu. */}
          <button
            data-shelf-popover
            onClick={onShelf ? handleToggle : () => onStatusChange('wishlist')}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium transition-opacity hover:opacity-70"
          >
            {!onShelf && <IoAdd className="h-3.5 w-3.5 flex-shrink-0" />}
            <span className="truncate">{currentLabel}</span>
          </button>
          {/* Chevron always opens the menu to pick a specific status. */}
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

      {anchor && createPortal(
        <div
          data-shelf-popover
          style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width, zIndex: 60 }}
          className="animate-fade-up overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] shadow-2xl backdrop-blur-xl"
        >
          <div className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => {
                const color = STATUS_COLOR[opt.key]
                const isCurrent = onShelf && opt.key === currentStatus
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleStatus(opt.key)}
                    style={{ borderLeftColor: color, color }}
                    className="flex items-center gap-1.5 rounded-r-lg border-l-[3px] px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                  >
                    {isCurrent && <IoCheckmark className="h-3 w-3" />}
                    {opt.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Collections</p>
              <div className="flex flex-wrap gap-1.5">
                {MOCK_COLLECTIONS.map((name) => {
                  const on = collections.includes(name)
                  return (
                    <button
                      key={name}
                      onClick={() => toggleCollection(name)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-transparent bg-nonsprimary/20 text-nonsprimary'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {on ? <IoCheckmark className="h-3 w-3" /> : <IoAdd className="h-3 w-3" />}
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
