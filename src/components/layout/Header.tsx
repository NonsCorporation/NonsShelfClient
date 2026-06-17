import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from '@/lib/router'
import {
  IoHomeOutline,
  IoLibraryOutline,
  IoCompassOutline,
  IoCalendarOutline,
  IoHeartOutline,
  IoLayersOutline,
  IoBookmarkOutline,
  IoTimeOutline,
  IoCheckmarkDoneOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoSearch,
  IoMenu,
  IoClose,
  IoChevronDown,
  IoLogOutOutline,
  IoLogInOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { FaCrown } from 'react-icons/fa6'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { useAuth } from '../../contexts/AuthContext'
import { initials, colorFor } from '../../lib/user'
import { redirectToNonsLogin } from '../../lib/api'
import { userPath, mediaPath } from '../../lib/paths'
import { isLibrarian } from '../../services/librarianService'
import { catalogService, type CatalogItem } from '../../services/catalogService'

type ShelfKey = 'all' | 'wishlist' | 'active' | 'done' | 'favorites'

type NavItem = { to: string; label: string; icon: IconType; match: (p: string) => boolean }

export default function Header() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { language, setLanguage, t } = useLanguage()
  const { showInProgress, setShowInProgress } = usePreferences()
  const { user, logout, isAuthenticated, loading } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const hidden = useHideOnScroll(drawerOpen || accountOpen)

  // The signed-in nons identity; null when logged out (possible on public pages).
  // Profile links go by username so they resolve against nons-server's lookup.
  const display = user
    ? {
        handle: user.username,
        profileId: user.username || user.uuid || '',
        name: user.name || user.username,
        avatar: user.avatar_url || '',
      }
    : null

  const path = location.pathname
  const onLibrary = path === '/library'
  const activeShelf = (params.get('shelf') as ShelfKey) || 'all'

  const nav: NavItem[] = [
    { to: '/', label: t('home'), icon: IoHomeOutline, match: (p) => p === '/' },
    { to: '/library', label: t('library'), icon: IoLibraryOutline, match: (p) => p === '/library' },
    { to: '/discover', label: t('discover'), icon: IoCompassOutline, match: (p) => p === '/discover' },
    { to: '/calendar', label: t('calendar'), icon: IoCalendarOutline, match: (p) => p === '/calendar' },
  ]
  if (isLibrarian(user?.role)) {
    nav.push({
      to: '/librarians',
      label: t('librarians'),
      icon: FaCrown,
      match: (p) => p.startsWith('/librarian'),
    })
  }

  const shelves: { key: ShelfKey; label: string; icon: IconType; dot?: string }[] = [
    { key: 'all', label: t('allItems'), icon: IoLayersOutline },
    { key: 'wishlist', label: t('shelfWishlist'), icon: IoBookmarkOutline, dot: '#6768ab' },
    { key: 'active', label: t('shelfActive'), icon: IoTimeOutline, dot: '#f5a623' },
    { key: 'done', label: t('shelfDone'), icon: IoCheckmarkDoneOutline, dot: '#3ec98a' },
    { key: 'favorites', label: t('favorites'), icon: IoHeartOutline, dot: '#ff7a85' },
  ]

  // Close the account menu on any outside click / route change.
  const accountRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!accountOpen) return
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [accountOpen])

  useEffect(() => {
    setDrawerOpen(false)
    setAccountOpen(false)
  }, [path])

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <header
      className={`sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_72%,transparent)] backdrop-blur-xl transition-transform duration-300 will-change-transform ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text)] transition-colors hover:bg-[var(--surface)] lg:hidden"
        >
          <IoMenu className="h-6 w-6" />
        </button>

        {/* Brand */}
        <Link to="/" className="group flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-6 w-6" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-[var(--text)] sm:block">
            Nons Shelf
          </span>
        </Link>

        {/* Primary nav — desktop */}
        <nav className="ml-3 hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = item.match(path)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border-subtle)]" />
                )}
                <Icon className="h-[17px] w-[17px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch />

          {/* Account */}
          {isAuthenticated && display ? (
            <div ref={accountRef} className="relative">
              <button
                onClick={() => setAccountOpen((v) => !v)}
                aria-label={t('viewProfile')}
                className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-[var(--surface)]"
              >
                <Avatar display={display} />
                <IoChevronDown
                  className={`hidden h-3.5 w-3.5 text-[var(--text-muted)] transition-transform sm:block ${
                    accountOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {accountOpen && (
                <div className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_94%,transparent)] shadow-2xl backdrop-blur-xl">
                  <Link
                    to={userPath(display.profileId)}
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface)]"
                  >
                    <Avatar display={display} big />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {display.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        @{display.handle}
                      </span>
                    </span>
                  </Link>

                  <div className="h-px bg-[var(--border-subtle)]" />

                  <div className="p-2">
                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {t('language') || 'Language'}
                    </p>
                    <div className="flex gap-1 px-1 pb-1">
                      {(['en', 'ru'] as const).map((lng) => (
                        <button
                          key={lng}
                          onClick={() => setLanguage(lng)}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                            language === lng
                              ? 'bg-[var(--surface-active)] text-[var(--text)]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                          }`}
                        >
                          {lng}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-[var(--border-subtle)]" />

                  <button
                    onClick={() => logout()}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    <IoLogOutOutline className="h-[18px] w-[18px]" />
                    {t('logout') || 'Log out'}
                  </button>
                </div>
              )}
            </div>
          ) : !loading ? (
            <button
              onClick={() => redirectToNonsLogin()}
              className="flex items-center gap-2 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <IoLogInOutline className="h-[18px] w-[18px]" />
              <span className="hidden sm:block">{t('login') || 'Sign in'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Contextual shelf bar — only on the Library page */}
      {onLibrary && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2.5 md:px-8">
            {shelves.map((s) => {
              const active = activeShelf === s.key
              const Icon = s.icon
              return (
                <div key={s.key} className="flex shrink-0 items-center">
                  <Link
                    to={s.key === 'all' ? '/library' : `/library?shelf=${s.key}`}
                    className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      active
                        ? 'border-transparent bg-[var(--primary-soft)] font-medium text-[var(--text)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text)]'
                    }`}
                  >
                    {s.dot ? (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {s.label}
                  </Link>
                  {s.key === 'active' && (
                    <button
                      onClick={() => setShowInProgress(!showInProgress)}
                      title={showInProgress ? t('hide') : t('show')}
                      aria-label={showInProgress ? t('hide') : t('show')}
                      className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface)] ${
                        showInProgress ? 'text-[var(--text-muted)] hover:text-[var(--text)]' : 'text-nonsprimary'
                      }`}
                    >
                      {showInProgress ? <IoEyeOutline className="h-4 w-4" /> : <IoEyeOffOutline className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={closeDrawer}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-5 border-r border-[var(--border-subtle)] bg-[var(--sidebar)] px-4 py-5 transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <Link to="/" onClick={closeDrawer} className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" className="h-6 w-6" />
              <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Nons Shelf</span>
            </Link>
            <button
              onClick={closeDrawer}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <IoClose className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = item.match(path)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('shelves')}
            </p>
            {shelves.map((s) => {
              const active = onLibrary && activeShelf === s.key
              const Icon = s.icon
              return (
                <Link
                  key={s.key}
                  to={s.key === 'all' ? '/library' : `/library?shelf=${s.key}`}
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {s.dot ? (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" />
                  )}
                  {s.label}
                </Link>
              )
            })}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <div className="flex rounded-lg border border-[var(--border-subtle)] p-1">
              {(['en', 'ru'] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setLanguage(lng)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                    language === lng
                      ? 'bg-[var(--surface)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {lng}
                </button>
              ))}
            </div>

            {isAuthenticated && display ? (
              <div className="flex items-center gap-2">
                <Link
                  to={userPath(display.profileId)}
                  onClick={closeDrawer}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface)]"
                >
                  <Avatar display={display} big />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--text)]">{display.name}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">@{display.handle}</span>
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  aria-label={t('logout') || 'Log out'}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                >
                  <IoLogOutOutline className="h-[18px] w-[18px]" />
                </button>
              </div>
            ) : !loading ? (
              <button
                onClick={() => redirectToNonsLogin()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-nonsprimary px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <IoLogInOutline className="h-[18px] w-[18px]" />
                {t('login') || 'Sign in'}
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </header>
  )

  // The avatar (initials fallback) — shared by the header button, dropdown and drawer.
  function Avatar({
    display,
    big,
  }: {
    display: { handle: string; name: string; avatar: string }
    big?: boolean
  }) {
    const size = big ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[11px]'
    return display.avatar ? (
      <img src={display.avatar} alt={display.name} className={`${size} flex-shrink-0 rounded-full object-cover`} />
    ) : (
      <span
        className={`${size} flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white`}
        style={{ backgroundColor: colorFor(display.handle) }}
      >
        {initials(display.name)}
      </span>
    )
  }
}

// Hide the header when scrolling down, reveal it the moment the user scrolls
// back up. Stays put near the top of the page and while a menu is open (so the
// drawer/account popover never slides away under the user).
function useHideOnScroll(locked: boolean): boolean {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    // This app sets overflow-x:hidden on html/body, so the scroll container can
    // be the body rather than the viewport. Read every plausible source, and
    // listen in the capture phase so we still hear scrolls that don't bubble to
    // window.
    const scrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    lastY.current = scrollTop()
    const onScroll = () => {
      const y = scrollTop()
      const delta = y - lastY.current
      // Ignore tiny jitters; never hide while pinned near the top.
      if (Math.abs(delta) > 6) {
        setHidden(delta > 0 && y > 80)
        lastY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  return locked ? false : hidden
}

// Global catalog search living in the header. Quick preview dropdown + Enter
// (or "see all") routes to /discover. Mirrors the behaviour that used to live
// in Layout.
function HeaderSearch() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const qParam = params.get('q') ?? ''
  useEffect(() => {
    // Adopt external URL changes (e.g. back/forward) into the editable field.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(qParam)
  }, [qParam])

  useEffect(() => {
    if (!value || !open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      catalogService.getCatalog(value).then((data) => {
        setResults(data.slice(0, 5))
        setLoading(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [value, open])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (!value) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [value])

  const expand = () => {
    setExpanded(true)
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const submit = () => {
    setOpen(false)
    const next = new URLSearchParams()
    if (value) next.set('q', value)
    const search = next.toString()
    navigate({ pathname: '/discover', search: search ? `?${search}` : '' }, { replace: true })
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Collapsed: just an icon button */}
      {!expanded && (
        <button
          onClick={expand}
          aria-label={t('globalSearch')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <IoSearch className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* Expanded: full search input */}
      {expanded && (
        <div className="animate-fade-up relative">
          <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true) }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('globalSearch')}
            aria-label={t('globalSearch')}
            className="h-10 w-64 rounded-full border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] md:w-72"
          />
        </div>
      )}

      {open && value && (
        <div className="animate-fade-up absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_94%,transparent)] shadow-2xl backdrop-blur-xl">
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">{t('loading')}</div>
            ) : results.length > 0 ? (
              results.map((item) => (
                <Link
                  key={item.id}
                  to={mediaPath(item)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface)]"
                >
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" className="h-12 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-8 rounded bg-[var(--surface)]" />
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
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">{t('noResults')}</div>
            )}
          </div>
          <div className="border-t border-[var(--border-subtle)] p-2">
            <button
              onClick={submit}
              className="w-full rounded-xl bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              {t('seeAllResults')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
