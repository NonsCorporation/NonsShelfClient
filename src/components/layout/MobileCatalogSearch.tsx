'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@/lib/router'
import { IoSearch } from 'react-icons/io5'
import { catalogService, type CatalogItem } from '@/services/catalogService'
import { mediaPath } from '@/lib/paths'
import TypeBadge from '@/components/badges/TypeBadge'
import InfinityLoader from '@/components/ui/InfinityLoader'

// The mobile-only catalog search box (desktop gets the header's inline
// HeaderSearch instead — the bottom nav pill has no room for a search field).
// Originally lived only on Feed; the catalog search endpoints are public, so
// this works identically for signed-out visitors on Discover/Home too.
export default function MobileCatalogSearch({
  t,
  onFocusChange,
}: {
  t: (key: string) => string
  /** Fires as the input gains/loses focus — lets the parent hide its logo
   *  while the search bar is active, so it gets the full row width. */
  onFocusChange?: (focused: boolean) => void
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)

  // Collapses the dropdown and hands focus state back to the parent. Not
  // wired to onBlur — blur fires before a result Link's click resolves, which
  // would close everything before the navigation click lands.
  const collapse = () => {
    setOpen(false)
    setFocused(false)
    onFocusChange?.(false)
  }

  useEffect(() => {
    if (!q.trim()) { setResults([]); setLoading(false); setImporting(false); setOpen(false); return }
    setLoading(true)
    setOpen(true)
    const timer = setTimeout(async () => {
      const data = await catalogService.getCatalog(q).catch(() => [] as CatalogItem[])
      if (data.length > 0) { setResults(data.slice(0, 6)); setLoading(false); return }
      setImporting(true)
      const fill = await catalogService.searchFill(q, { limit: 10, series: true })
      setImporting(false)
      setResults(fill.items.slice(0, 6))
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const submit = () => {
    if (!q.trim()) return
    collapse()
    navigate({ pathname: '/search', search: `?q=${encodeURIComponent(q.trim())}` })
  }

  return (
    <div className="relative">
      <div className="relative">
        <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={() => { setFocused(true); onFocusChange?.(true); if (q.trim()) setOpen(true) }}
          placeholder={t('globalSearch') || 'Search books, films…'}
          className="h-11 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
        />
      </div>

      {/* Invisible outside-click catcher — active whenever the field is
          focused, not just when a dropdown is showing, so an empty-query
          focus (logo hidden, row expanded) also collapses back on an
          outside tap. */}
      {focused && <div className="fixed inset-0 z-30" onClick={collapse} />}

      {open && (
        <>
          <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] shadow-2xl">
            {loading && !importing && (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-2" style={{ opacity: 1 - i * 0.25 }}>
                    <div className="h-12 w-8 animate-pulse rounded bg-[var(--surface)]" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface)]" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface)]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {importing && (
              <div className="flex justify-center py-4">
                <InfinityLoader size={70} hint={t('searchingExternal')} />
              </div>
            )}
            {!loading && !importing && results.length > 0 && (
              <div className="p-2">
                {results.map((item) => (
                  <Link
                    key={item.id}
                    to={mediaPath(item)}
                    onClick={collapse}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface)]"
                  >
                    <div className="relative aspect-[2/3] w-8 flex-shrink-0">
                      {item.coverUrl
                        ? <img src={item.coverUrl} alt="" className="h-full w-full rounded object-cover" />
                        : <div className="h-full w-full rounded bg-[var(--surface)]" />}
                      <TypeBadge type={item.type} position="-top-1 -right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">
                        {item.type === 'book' ? item.author : item.director || item.author}
                      </div>
                    </div>
                  </Link>
                ))}
                <button
                  onClick={submit}
                  className="mt-1 w-full rounded-xl bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {t('seeAllResults')}
                </button>
              </div>
            )}
            {!loading && !importing && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-[var(--text-muted)]">{t('noResults')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
