import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { IoMenu, IoSearch } from 'react-icons/io5'
import Sidebar from './Sidebar'
import { useLanguage } from '../../contexts/LanguageContext'
import { catalogService, type CatalogItem } from '../../services/catalogService'

type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [searchValue, setSearchValue] = useState(params.get('q') ?? '')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [previewResults, setPreviewResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  
  // create reference to the input element in the dom
  const inputRef = useRef<HTMLInputElement>(null)
  
  // create reference to the search container to detect outside clicks
  const containerRef = useRef<HTMLDivElement>(null)

  // auto-focus the input if a search query is present on mount
  useEffect(() => {
    if (params.get('q') && inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // sync local state with external url changes
  useEffect(() => {
    setSearchValue(params.get('q') ?? '')
  }, [params])

  // fetch quick results for the search dropdown modal
  useEffect(() => {
    if (!searchValue || !isModalOpen) {
      setPreviewResults([])
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      catalogService.getCatalog(searchValue).then((data) => {
        setPreviewResults(data.slice(0, 5))
        setLoading(false)
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, isModalOpen])

  // close modal when clicking outside the search area
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsModalOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // update local state and open the search modal
  const onSearchChange = (value: string) => {
    setSearchValue(value)
    setIsModalOpen(true)
  }

  // navigate to the full search results page
  const submitFullSearch = () => {
    setIsModalOpen(false)
    const next = new URLSearchParams()
    if (searchValue) next.set('q', searchValue)
    const search = next.toString()
    navigate({ pathname: '/discover', search: search ? `?${search}` : '' }, { replace: true })
  }

  // trigger full search on enter key press
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitFullSearch()
    }
  }

  return (
    <div className="app-ambient relative min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-2 text-[var(--text)] lg:hidden"
            >
              <IoMenu className="h-6 w-6" />
            </button>
            <div ref={containerRef} className="relative min-w-0 flex-1 md:max-w-md">
              <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsModalOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={t('globalSearch')}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />

              {/* search dropdown modal */}
              {isModalOpen && searchValue && (
                <div className="absolute left-0 right-0 z-20 top-full mt-2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] shadow-xl">
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                    {loading ? (
                      <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                        {t('loading')}
                      </div>
                    ) : previewResults.length > 0 ? (
                      previewResults.map((item) => (
                        <Link
                          key={item.id}
                          to={`/media/${item.id}`}
                          onClick={() => setIsModalOpen(false)}
                          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--container)]"
                        >
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt="" className="h-12 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-12 w-8 rounded bg-[var(--bg)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</div>
                            <div className="truncate text-xs text-[var(--text-muted)]">
                              {item.type === 'book' ? item.author : item.director || item.author}
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                        {t('noResults')}
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg)] p-2">
                    <button
                      onClick={submitFullSearch}
                      className="w-full rounded-lg bg-[var(--container)] py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--border-subtle)]"
                    >
                      {t('seeAllResults')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="relative z-10">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  )
}