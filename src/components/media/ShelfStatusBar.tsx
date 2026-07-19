'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useId } from 'react'
import { IoChevronDown, IoCheckmark, IoAdd, IoTrendingUpOutline, IoClose, IoFolderOutline, IoLayersOutline, IoTrashOutline } from 'react-icons/io5'
import { TbSpy } from 'react-icons/tb'
import type { MediaItem, ShelfStatus } from '@/types'
import { STATUS_COLOR, statusLabel } from '@/lib/shelf'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCollections } from '@/contexts/CollectionContext'
import { useLists } from '@/contexts/ListContext'
import { collectionService } from '@/services/collectionService'
import { listService } from '@/services/listService'
import { libraryService } from '@/services/libraryService'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Props = {
  item: MediaItem
  currentStatus: ShelfStatus | null
  onStatusChange: (status: ShelfStatus) => void
  onEditProgress?: () => void
  onRemove?: () => void
  variant?: 'bar' | 'button'
}

export default function ShelfStatusBar({ item, currentStatus, onStatusChange, onEditProgress, onRemove, variant = 'bar' }: Props) {
  const { t } = useLanguage()
  const { collections, createCollection, refresh } = useCollections()
  const { lists, createList, refresh: refreshLists } = useLists()
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
  // tracks which user curated lists contain this item
  const [itemListIds, setItemListIds] = useState<number[]>(item.listIds ?? [])
  const [listLoading, setListLoading] = useState(false)
  // positions the popover based on available vertical viewport space
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; left: number; width: number; placement: 'up' | 'down' } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // purely visual for now — not yet wired to any share/privacy behavior
  const [incognito, setIncognito] = useState(false)
  const [incognitoToast, setIncognitoToast] = useState(false)
  const showIncognitoToast = () => {
    setIncognitoToast(true)
    setTimeout(() => setIncognitoToast(false), 2000)
  }

  // uniquely identifies this instance of the component to scope outside-click events
  const popoverId = useId()

  // holds state for the inline new-collection form
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  // holds state for the inline new-list form
  const [creatingNewList, setCreatingNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const newListInputRef = useRef<HTMLInputElement>(null)

  // syncs local state when the item's collectionids prop changes
  useEffect(() => {
    setItemCollectionIds(item.collectionIds ?? [])
  }, [item.collectionIds])

  // syncs local state when the item's listIds prop changes
  useEffect(() => {
    setItemListIds(item.listIds ?? [])
  }, [item.listIds])

  // provides a baseline height to determine popup placement direction
  const ESTIMATED_POPOVER_HEIGHT = 320

  const handleToggle = () => {
    if (anchor) { setAnchor(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const extraWidth = onEditProgress ? 36 : 0
    const width = Math.max(r.width + extraWidth, 260)
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const placement: 'up' | 'down' =
      spaceBelow < ESTIMATED_POPOVER_HEIGHT && spaceAbove > spaceBelow ? 'up' : 'down'
    setAnchor(
      placement === 'up'
        ? { bottom: window.innerHeight - r.top + 6, left: r.left, width, placement }
        : { top: r.bottom + 6, left: r.left, width, placement },
    )

    // lazily fetches collections containing this item
    setColLoading(true)
    collectionService.getItemCollections(item.id).then((ids) => {
      setItemCollectionIds(ids)
      setColLoading(false)
    }).catch(() => setColLoading(false))

    // lazily fetches curated lists containing this item
    setListLoading(true)
    listService.getItemLists(item.id).then((ids) => {
      setItemListIds(ids)
      setListLoading(false)
    }).catch(() => setListLoading(false))
  }

  useEffect(() => {
    if (!anchor) return
    
    // closes the popover when interacting outside this specific component instance
    const close = (e: Event) => {
      const target = e.target as Element
      if (target?.closest && !target.closest(`[data-shelf-popover="${popoverId}"]`)) {
        setAnchor(null)
      }
    }
    
    document.addEventListener('pointerdown', close)
    document.addEventListener('touchstart', close, { passive: true })

    // closes the popover on scroll events outside of this specific component instance
    const closeOnScroll = (e: Event) => {
      const target = e.target as Element
      if (target?.closest && target.closest(`[data-shelf-popover="${popoverId}"]`)) return
      setAnchor(null)
    }
    
    if (!isMobile) {
      window.addEventListener('scroll', closeOnScroll, { passive: true, capture: true })
    }
    
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('touchstart', close)
      if (!isMobile) window.removeEventListener('scroll', closeOnScroll, { capture: true })
    }
  }, [anchor, isMobile, popoverId])

  useEffect(() => {
    if (creatingNew) setTimeout(() => newInputRef.current?.focus(), 30)
  }, [creatingNew])

  useEffect(() => {
    if (creatingNewList) setTimeout(() => newListInputRef.current?.focus(), 30)
  }, [creatingNewList])

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

  const toggleList = async (id: number) => {
    const on = itemListIds.includes(id)
    const next = on ? itemListIds.filter((l) => l !== id) : [...itemListIds, id]
    setItemListIds(next)
    if (on) await listService.removeListItem(id, Number(item.id))
    else await listService.addListItem(id, item.id)

    // updates the item count in the sidebar
    refreshLists()
  }

  const handleCreateNewList = async () => {
    const name = newListName.trim()
    if (!name) return
    const l = await createList(name)
    setNewListName('')
    setCreatingNewList(false)

    // automatically adds the item to the newly created list
    setItemListIds((prev) => [...prev, l.id])
    await listService.addListItem(l.id, item.id)
    refreshLists()
  }

  const popoverBody = (
    <>
      {/* renders the shelf status options */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={showIncognitoToast}
          title={incognito ? 'Incognito on' : 'Incognito off'}
          aria-pressed={incognito}
          className={`flex items-center justify-center rounded-full border px-2.5 py-1.5 transition-colors ${
            incognito
              ? 'border-transparent bg-nonsprimary/20 text-nonsprimary'
              : 'border-[var(--text)]/70 text-[var(--text-muted)] hover:border-nonsprimary hover:text-[var(--text)]'
          }`}
        >
          <TbSpy className="h-3.5 w-3.5" />
        </button>
        {statusOptions.map((opt) => {
          const color = incognito ? 'var(--text-muted)' : STATUS_COLOR[opt.key]
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
                  {on ? <IoCheckmark className="h-3 w-3" /> : <IoFolderOutline className="h-3 w-3" />}
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

      {/* renders the list of curated lists */}
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Lists
        </p>

        {listLoading ? (
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-[var(--surface)]" />
            ))}
          </div>
        ) : lists.length === 0 && !creatingNewList ? (
          <p className="text-xs text-[var(--text-muted)]">No lists yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {lists.map((l) => {
              const on = itemListIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggleList(l.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? 'border-transparent bg-nonsprimary/20 text-nonsprimary'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  {on ? <IoCheckmark className="h-3 w-3" /> : <IoLayersOutline className="h-3 w-3" />}
                  {l.title}
                </button>
              )
            })}
          </div>
        )}

        {/* renders the inline form to create a new list */}
        {creatingNewList ? (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              ref={newListInputRef}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateNewList()
                if (e.key === 'Escape') { setCreatingNewList(false); setNewListName('') }
              }}
              placeholder="List title"
              className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)]"
            />
            <button
              onClick={handleCreateNewList}
              disabled={!newListName.trim()}
              className="flex h-7 items-center rounded-lg bg-nonsprimary px-2.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={() => { setCreatingNewList(false); setNewListName('') }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)]"
            >
              <IoClose className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingNewList(true)}
            className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <IoAdd className="h-3.5 w-3.5" />
            New list
          </button>
        )}
      </div>

      {/* removes the item from the shelf completely */}
      {onShelf && onRemove && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <button
            onClick={() => { setAnchor(null); setConfirmingRemove(true) }}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <IoTrashOutline className="h-3.5 w-3.5" />
            {t('removeFromShelf') || 'Remove from shelf'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      {variant === 'button' ? (
        // renders a prominent pill for standalone use
        <div ref={btnRef} className="inline-flex max-w-full">
          <button
            data-shelf-popover={popoverId}
            onClick={onShelf ? handleToggle : () => onStatusChange('wishlist')}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            {onShelf && <IoChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${anchor ? 'rotate-180' : ''}`} />}
            {!onShelf && <IoAdd className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />}
            <span className="truncate">{currentLabel}</span>
            {onShelf && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full border-[1.5px]" style={{ borderColor: incognito ? 'var(--text-muted)' : accent }} />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div
            ref={btnRef}
            style={{ borderLeftColor: incognito ? 'var(--text-muted)' : accent, color: incognito ? 'var(--text-muted)' : accent }}
            className="flex min-w-0 flex-1 items-center rounded-r-lg border-l-[3px]"
          >
            <button
              data-shelf-popover={popoverId}
              onClick={onShelf ? handleToggle : () => onStatusChange('wishlist')}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2.5 text-xs font-medium transition-opacity hover:opacity-70"
            >
              {!onShelf && <IoAdd className="h-3.5 w-3.5 flex-shrink-0" />}
              <span className="truncate">{currentLabel}</span>
            </button>
            <button
              data-shelf-popover={popoverId}
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

          {onShelf && onRemove && (
            <button
              onClick={() => setConfirmingRemove(true)}
              title={t('removeFromShelf') || 'Remove from shelf'}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <IoClose className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {anchor && createPortal(
        isMobile ? (
          <div
            data-shelf-popover={popoverId}
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
          data-shelf-popover={popoverId}
          style={{
            position: 'fixed',
            top: anchor.top,
            bottom: anchor.bottom,
            left: anchor.left,
            width: anchor.width,
            maxHeight: 'min(70vh, 480px)',
            zIndex: 60,
          }}
          className="animate-fade-up flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] shadow-2xl backdrop-blur-xl"
        >
          <div className="overflow-y-auto p-3">{popoverBody}</div>
        </div>
        ),
        document.body,
      )}

      {confirmingRemove && (
        <ConfirmModal
          title={t('removeFromShelf') || 'Remove from shelf'}
          message={t('removeFromShelfConfirm') || 'This removes it from your shelf along with any rating, review and progress. It can be added back later.'}
          confirmText={t('delete')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={() => { setConfirmingRemove(false); onRemove?.() }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}

      {incognitoToast && createPortal(
        <div className="fixed bottom-28 left-1/2 z-[80] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--container)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg backdrop-blur-sm lg:bottom-6">
          Coming soon
        </div>,
        document.body,
      )}
    </>
  )
}