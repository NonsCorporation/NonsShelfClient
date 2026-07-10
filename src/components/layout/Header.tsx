'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from '@/lib/router'
import {
  IoHomeOutline,
  IoLibraryOutline,
  IoCompassOutline,
  IoCalendarOutline,
  IoSearch,
  IoClose,
  IoChevronDown,
  IoLogOutOutline,
  IoLogInOutline,
  IoPersonOutline,
  IoNotificationsOutline,
  IoInformationCircleOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { HiOutlineLibrary } from 'react-icons/hi'
import { useLanguage } from '../../contexts/LanguageContext'
import LanguageSelect from '../LanguageSelect'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { redirectToNonsLogin, NONS_LOGIN_URL } from '../../lib/api'
import BoringAvatar from '../BoringAvatar'
import { userPath, mediaPath } from '../../lib/paths'
import { isLibrarian } from '../../services/librarianService'
import { catalogService, type CatalogItem } from '../../services/catalogService'
import TypeBadge from '../TypeBadge'
import ShelfLogo from '../ShelfLogo'
import NonsLogo from '../NonsLogo'
import InfinityLoader from '../InfinityLoader'

type NavItem = { to: string; label: string; icon: IconType; match: (p: string) => boolean }

export default function Header() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { language, setLanguage, t } = useLanguage()
  const { user, logout, isAuthenticated, loading } = useAuth()
  const { totalUnread, unreadCount } = useNotifications()

  const [accountOpen, setAccountOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const hidden = useHideOnScroll(accountOpen || profileOpen)

  const display = user
    ? {
        id: user.id,
        handle: user.username,
        profileId: user.username || user.uuid || '',
        name: user.name || user.username,
        avatar: user.avatar_url || '',
      }
    : null

  const path = location.pathname

  const nav: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { to: '/', label: t('home'), icon: IoHomeOutline, match: (p) => p === '/' },
      { to: '/library', label: t('library'), icon: IoLibraryOutline, match: (p) => p === '/library' },
      { to: '/discover', label: t('discover'), icon: IoCompassOutline, match: (p) => p === '/discover' },
      { to: '/statistics', label: t('statistics'), icon: IoCalendarOutline, match: (p) => p === '/statistics' },
    ]
    if (isLibrarian(user?.role)) {
      items.push({ to: '/librarians', label: t('librarians'), icon: HiOutlineLibrary, match: (p) => p.startsWith('/librarian') })
    }
    return items
  }, [t, user?.role])

  const accountRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!accountOpen) return
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [accountOpen])

  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!profileOpen) return
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [profileOpen])

  useEffect(() => {
    setAccountOpen(false)
    setProfileOpen(false)
  }, [path])

  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const measureIndicator = useCallback(() => {
    const navEl = navRef.current
    const activeItem = nav.find((item) => item.match(path))
    if (!navEl || !activeItem) {
      setIndicator((prev) => (prev === null ? prev : null))
      return
    }
    const linkEl = navEl.querySelector<HTMLElement>(`[data-nav-key="${activeItem.to}"]`)
    if (!linkEl) return
    const next = { left: linkEl.offsetLeft, top: linkEl.offsetTop, width: linkEl.offsetWidth, height: linkEl.offsetHeight }
    setIndicator((prev) => {
      if (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height) {
        return prev
      }
      return next
    })
  }, [nav, path])

  useLayoutEffect(() => {
    measureIndicator()
  }, [measureIndicator])

  useEffect(() => {
    window.addEventListener('resize', measureIndicator)
    return () => window.removeEventListener('resize', measureIndicator)
  }, [measureIndicator])

  return (
    <>
      {/* ── Top header (desktop only) ── */}
      <header
        className={`sticky top-0 z-40 hidden bg-[color-mix(in_srgb,var(--nav-bg)_35%,transparent)] backdrop-blur-xl transition-transform duration-300 will-change-transform lg:block ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-8">
          {/* Brand */}
          <Link to="/" className="group flex flex-shrink-0 items-center gap-2.5">
            <ShelfLogo className="h-6 w-6 text-white" />
            <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight text-[var(--text)] sm:block">
              Nons Shelf
            </span>
          </Link>

          {/* Primary nav — desktop only, grouped in its own pill, centered in the header.
              Centering is left-1/2 + -translate-x-1/2 (based on the pill's own width), so
              when the search button inside it expands into an input, the whole pill grows
              symmetrically and stays centered automatically — no extra logic needed. */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] p-1 lg:flex">
            <nav ref={navRef} className="relative flex items-center gap-1">
              {indicator && (
                <span
                  className="absolute -z-10 rounded-full bg-[var(--surface-active)] ring-1 ring-inset ring-[var(--border-subtle)] transition-[left,width] duration-300 ease-out"
                  style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }}
                />
              )}
              {nav.map((item) => {
                const active = item.match(path)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-nav-key={item.to}
                    className={`group flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
                      active ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="h-4 w-px flex-shrink-0 bg-[var(--border-subtle)]" />

            {/* Search — icon-only until clicked, then expands into an input */}
            <HeaderSearch />
          </div>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && (
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <IoNotificationsOutline className="h-[19px] w-[19px]" />
                {totalUnread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-nonsprimary px-1 text-[10px] font-bold leading-none text-white">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>
            )}

            {/* Account — desktop only; mobile uses the bottom-nav profile sheet */}
            {isAuthenticated && display ? (
              <div ref={accountRef} className="relative hidden lg:block">
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
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">{display.name}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">@{display.handle}</span>
                      </span>
                    </Link>

                    <a
                      href={NONS_LOGIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center px-4 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                    >
                      Go to Nons&nbsp;↗
                    </a>

                    <div className="h-px bg-[var(--border-subtle)]" />

                    <div className="p-2">
                      <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        {t('language')}
                      </p>
                      <div className="px-2 pb-2">
                        <LanguageSelect value={language} onChange={setLanguage} />
                      </div>
                    </div>

                    <div className="h-px bg-[var(--border-subtle)]" />

                    <Link
                      to="/about"
                      onClick={() => setAccountOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                    >
                      <IoInformationCircleOutline className="h-[18px] w-[18px]" />
                      {t('about') || 'About'}
                    </Link>

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
                className="hidden items-center gap-2 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 lg:flex"
              >
                <IoLogInOutline className="h-[18px] w-[18px]" />
                <span className="hidden sm:block">{t('login') || 'Sign in'}</span>
              </button>
            ) : null}
          </div>
        </div>

      </header>

      {/* ── Bottom gradient scrim ── */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 h-20 bg-gradient-to-t from-[var(--bg)] to-transparent lg:hidden" />

      {/* ── Mobile bottom nav (floating oval pill) ── */}
      <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-50 flex justify-center lg:hidden">
        <nav className="pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--nav-bg)_85%,transparent)] px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          {[
            { to: '/', icon: IoHomeOutline, label: t('home') || 'Home', active: path === '/' },
            { to: '/discover', icon: IoCompassOutline, label: t('discover') || 'Discover', active: path === '/discover' },
            { to: '/library', icon: IoLibraryOutline, label: t('library') || 'Library', active: path === '/library' },
          ].map(({ to, icon: Icon, label, active }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
                active ? 'bg-[var(--surface)] text-[var(--text)] ring-1 ring-inset ring-[var(--border-subtle)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="flex h-[22px] items-center justify-center">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          ))}

          {/* Profile — opens compact popover */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
                profileOpen ? 'bg-[var(--surface)] text-[var(--text)] ring-1 ring-inset ring-[var(--border-subtle)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="flex h-[22px] items-center justify-center">
                {display ? <Avatar display={display} /> : <IoPersonOutline className="h-[22px] w-[22px]" />}
              </span>
              <span className="text-[10px] font-medium leading-none">{t('profile') || 'Profile'}</span>
            </button>

            {/* Compact popover */}
            {profileOpen && (
              <div className="absolute bottom-full right-0 mb-3 w-56 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_96%,transparent)] shadow-2xl backdrop-blur-xl">
                {isAuthenticated && display ? (
                  <Link
                    to={userPath(display.profileId)}
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface)]"
                  >
                    <Avatar display={display} big />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">{display.name}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">@{display.handle}</span>
                    </span>
                  </Link>
                ) : null}

                <div className="h-px bg-[var(--border-subtle)]" />

                <div className="p-3">
                  <LanguageSelect value={language} onChange={setLanguage} />
                </div>

                {/* renders librarian link for authorized accounts */}
                {isLibrarian(user?.role) && (
                  <>
                    <div className="h-px bg-[var(--border-subtle)]" />
                    <Link
                      to="/librarians"
                      onClick={() => setProfileOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                    >
                      <HiOutlineLibrary className="h-[18px] w-[18px]" />
                      {t('librarians') || 'Librarians'}
                    </Link>
                  </>
                )}

                <div className="h-px bg-[var(--border-subtle)]" />

                <Link
                  to="/notifications"
                  onClick={() => setProfileOpen(false)}
                  className={`relative flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] ${path === '/notifications' ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
                >
                  <IoNotificationsOutline className="h-[18px] w-[18px]" />
                  {t('notifications') || 'Notifications'}
                  {totalUnread > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-nonsprimary px-1.5 text-[10px] font-bold text-white">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </Link>

                <div className="h-px bg-[var(--border-subtle)]" />

                <Link
                  to="/statistics"
                  onClick={() => setProfileOpen(false)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] ${path === '/statistics' ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
                >
                  <IoCalendarOutline className="h-[18px] w-[18px]" />
                  {t('statistics') || 'Statistics'}
                </Link>

                <div className="h-px bg-[var(--border-subtle)]" />

                <Link
                  to="/about"
                  onClick={() => setProfileOpen(false)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] ${path === '/about' ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
                >
                  <IoInformationCircleOutline className="h-[18px] w-[18px]" />
                  {t('about') || 'About'}
                </Link>

                <div className="h-px bg-[var(--border-subtle)]" />

                <a
                  href={NONS_LOGIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                >
                  <NonsLogo className="h-[18px] w-[18px]" />
                  {t('goToNons') || 'Go to Nons'}
                </a>

                <div className="h-px bg-[var(--border-subtle)]" />

                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); setProfileOpen(false) }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    <IoLogOutOutline className="h-[18px] w-[18px]" />
                    {t('logout') || 'Log out'}
                  </button>
                ) : (
                  <button
                    onClick={() => { redirectToNonsLogin(); setProfileOpen(false) }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-nonsprimary transition-colors hover:bg-[var(--surface)]"
                  >
                    <IoLogInOutline className="h-[18px] w-[18px]" />
                    {t('login') || 'Sign in'}
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  )

  function Avatar({ display, big }: { display: { id: number; handle: string; name: string; avatar: string }; big?: boolean }) {
    const px = big ? 36 : 32
    return display.avatar ? (
      <img src={display.avatar} alt={display.name} style={{ width: px, height: px }} className="flex-shrink-0 rounded-full object-cover" />
    ) : (
      <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: px, height: px }}>
        <BoringAvatar size={px} name={`user-${display.id}`} />
      </span>
    )
  }
}

function useHideOnScroll(locked: boolean): boolean {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    const scrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    lastY.current = scrollTop()
    const onScroll = () => {
      const y = scrollTop()
      const delta = y - lastY.current
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

function HeaderSkeletons() {
  return (
    <>
      <style>{`
        @keyframes hsk {
          0%   { background-position: -300px 0 }
          100% { background-position:  300px 0 }
        }
        .hsk {
          border-radius: 5px;
          background: linear-gradient(
            90deg,
            var(--surface-hover) 25%,
            var(--surface-active) 50%,
            var(--surface-hover) 75%
          );
          background-size: 600px 100%;
          animation: hsk 1.5s ease-in-out infinite;
        }
      `}</style>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl p-2"
          style={{ opacity: 1 - i * 0.18 }}
        >
          <div className="hsk h-12 w-8 flex-shrink-0 rounded" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="hsk h-3.5 w-2/3 rounded" />
            <div className="hsk h-3 w-2/5 rounded" />
          </div>
        </div>
      ))}
    </>
  )
}

function HeaderSearch() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const isSearchPage = pathname === '/search'
  const [value, setValue] = useState(params.get('q') ?? '')
  const [expanded, setExpanded] = useState(isSearchPage)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const qParam = params.get('q') ?? ''
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(qParam)
  }, [qParam])

  useEffect(() => {
    if (isSearchPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(true)
    }
  }, [isSearchPage])

  useEffect(() => {
    if (!value || !open) {
      setResults([])
      setImporting(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const data = await catalogService.getCatalog(value).catch(() => [] as CatalogItem[])
      if (data.length > 0) {
        setResults(data.slice(0, 5))
        setLoading(false)
        return
      }
      setImporting(true)
      const fill = await catalogService.searchFill(value, { limit: 10, series : true })
      setImporting(false)
      setResults(fill.items.slice(0, 5))
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [value, open])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (!value && !isSearchPage) setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [value, isSearchPage])

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
    navigate({ pathname: '/search', search: search ? `?${search}` : '' })
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      {!expanded && (
        <button
          onClick={expand}
          aria-label={t('globalSearch')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <IoSearch className="h-[18px] w-[18px]" />
        </button>
      )}

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
        <div className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_94%,transparent)] shadow-2xl backdrop-blur-xl">
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading && !importing && <HeaderSkeletons />}

            {importing && (
              <div className="flex justify-center py-3">
                <InfinityLoader size={80} hint={t('searchingExternal')} />
              </div>
            )}

            {!loading && !importing && results.length > 0 ? (
              results.map((item) => (
                <Link
                  key={item.id}
                  to={mediaPath(item)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface)]"
                >
                  <div className="relative aspect-[2/3] w-8 flex-shrink-0">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" className="h-full w-full rounded object-cover" />
                    ) : (
                      <div className="h-full w-full rounded bg-[var(--surface)]" />
                    )}
                    <TypeBadge type={item.type} position="-top-1 -right-1" size="h-5 w-5" iconSize="h-2.5 w-2.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">
                      {item.type === 'book' ? item.author : item.director || item.author}
                    </div>
                  </div>
                </Link>
              ))
            ) : null}

            {!loading && !importing && results.length === 0 && (
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