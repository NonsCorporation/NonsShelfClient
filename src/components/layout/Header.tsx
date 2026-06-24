'use client'

import { useEffect, useRef, useState } from 'react'
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
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { FaCrown } from 'react-icons/fa6'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { initials, colorFor } from '../../lib/user'
import { redirectToNonsLogin } from '../../lib/api'
import { userPath, mediaPath } from '../../lib/paths'
import { isLibrarian } from '../../services/librarianService'
import { catalogService, type CatalogItem } from '../../services/catalogService'
import TypeBadge from '../TypeBadge'
import ShelfLogo from '../ShelfLogo'
import InfinityLoader from '../InfinityLoader'

type NavItem = { to: string; label: string; icon: IconType; match: (p: string) => boolean }

export default function Header() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { language, setLanguage, t } = useLanguage()
  const { user, logout, isAuthenticated, loading } = useAuth()

  const [accountOpen, setAccountOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileQ, setMobileQ] = useState('')
  const [mobileResults, setMobileResults] = useState<CatalogItem[]>([])
  const [mobileImporting, setMobileImporting] = useState(false)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const hidden = useHideOnScroll(accountOpen || sheetOpen)

  const display = user
    ? {
        handle: user.username,
        profileId: user.username || user.uuid || '',
        name: user.name || user.username,
        avatar: user.avatar_url || '',
      }
    : null

  const path = location.pathname

  const nav: NavItem[] = [
    { to: '/', label: t('home'), icon: IoHomeOutline, match: (p) => p === '/' },
    { to: '/library', label: t('library'), icon: IoLibraryOutline, match: (p) => p === '/library' },
    { to: '/discover', label: t('discover'), icon: IoCompassOutline, match: (p) => p === '/discover' },
    { to: '/calendar', label: t('calendar'), icon: IoCalendarOutline, match: (p) => p === '/calendar' },
  ]
  if (isLibrarian(user?.role)) {
    nav.push({ to: '/librarians', label: t('librarians'), icon: FaCrown, match: (p) => p.startsWith('/librarian') })
  }

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
    setAccountOpen(false)
    setSheetOpen(false)
    setMobileSearchOpen(false)
  }, [path])

  useEffect(() => {
    if (!mobileSearchOpen) { setMobileQ(''); setMobileResults([]); return }
    setTimeout(() => mobileInputRef.current?.focus(), 50)
  }, [mobileSearchOpen])

  useEffect(() => {
    if (!mobileQ) { setMobileResults([]); setMobileImporting(false); return }
    const timer = setTimeout(async () => {
      const data = await catalogService.getCatalog(mobileQ).catch(() => [] as CatalogItem[])
      if (data.length > 0) { setMobileResults(data.slice(0, 6)); return }
      setMobileImporting(true)
      const fill = await catalogService.searchFill(mobileQ, { limit: 2 })
      setMobileImporting(false)
      setMobileResults(fill.items.slice(0, 6))
    }, 280)
    return () => clearTimeout(timer)
  }, [mobileQ])

  return (
    <>
      {/* ── Top header (desktop only) ── */}
      <header
        className={`sticky top-0 z-40 hidden border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--container)_72%,transparent)] backdrop-blur-xl transition-transform duration-300 will-change-transform lg:block ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
          {/* Brand */}
          <Link to="/" className="group flex items-center gap-2.5">
            <ShelfLogo className="h-6 w-6 text-white" />
            <span className="hidden text-[15px] font-semibold tracking-tight text-[var(--text)] sm:block">
              Nons Shelf
            </span>
          </Link>

          {/* Primary nav — desktop only */}
          <nav className="ml-3 hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active = item.match(path)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
                    active ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 h-36 bg-gradient-to-t from-[var(--bg)] to-transparent lg:hidden" />

      {/* ── Mobile bottom nav (floating oval pill) ── */}
      <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-50 flex justify-center lg:hidden">
        <nav className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          {[
            { to: '/', icon: IoHomeOutline, label: t('home') || 'Home', active: path === '/' },
            { to: '/discover', icon: IoCompassOutline, label: t('discover') || 'Discover', active: path === '/discover' },
          ].map(({ to, icon: Icon, label, active }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
                active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="flex h-[22px] items-center justify-center">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          ))}

          {/* Search */}
          <button
            onClick={() => setMobileSearchOpen(true)}
            className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
              mobileSearchOpen ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="flex h-[22px] items-center justify-center">
              <IoSearch className="h-[22px] w-[22px]" />
            </span>
            <span className="text-[10px] font-medium leading-none">Search</span>
          </button>

          {/* Profile — opens the sheet */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
              sheetOpen ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="flex h-[22px] items-center justify-center">
              {display ? (
                <Avatar display={display} />
              ) : (
                <IoPersonOutline className="h-[22px] w-[22px]" />
              )}
            </span>
            <span className="text-[10px] font-medium leading-none">{t('profile') || 'Profile'}</span>
          </button>
        </nav>
      </div>

      {/* ── Mobile search overlay ── */}
      {mobileSearchOpen && (
        <>
          <div onClick={() => setMobileSearchOpen(false)} className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden" />
          <div className="animate-slide-up fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-[var(--border-subtle)] bg-[var(--container)] lg:hidden">
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 pt-1">
              <div className="relative flex-1">
                <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  ref={mobileInputRef}
                  value={mobileQ}
                  onChange={(e) => setMobileQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mobileQ) {
                      setMobileSearchOpen(false)
                      window.location.href = `/search?q=${encodeURIComponent(mobileQ)}`
                    }
                  }}
                  placeholder={t('globalSearch') || 'Search books, films…'}
                  className="h-11 w-full rounded-full border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                />
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]"
              >
                <IoClose className="h-5 w-5" />
              </button>
            </div>
            {mobileImporting && (
              <div className="px-5 pb-3 text-sm text-[var(--text-muted)]">
                Searching external sources…
              </div>
            )}
            {!mobileImporting && mobileResults.length > 0 && (
              <div className="max-h-[55dvh] overflow-y-auto px-3 pb-3">
                {mobileResults.map((item) => (
                  <Link
                    key={item.id}
                    to={mediaPath(item)}
                    onClick={() => setMobileSearchOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface)]"
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
                ))}
              </div>
            )}
            <div className="pb-safe h-6" />
          </div>
        </>
      )}

      {/* ── Profile / more sheet ── */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
          />

          {/* Sheet */}
          <div className="animate-slide-up fixed inset-x-0 bottom-0 z-[70] max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--border-subtle)] bg-[var(--container)] lg:hidden">
            {/* Drag handle */}
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>

            {/* Account row */}
            {isAuthenticated && display ? (
              <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
                <Link
                  to={userPath(display.profileId)}
                  onClick={() => setSheetOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar display={display} big />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--text)]">{display.name}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">@{display.handle}</span>
                  </span>
                </Link>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]"
                >
                  <IoClose className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-5 pb-4 pt-2">
                <p className="text-sm font-semibold text-[var(--text)]">Menu</p>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]"
                >
                  <IoClose className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* Nav links: library + calendar + any extras (librarians etc.) */}
            <nav className="p-3">
              {nav
                .filter((item) => !['/', '/discover'].includes(item.to))
                .map((item) => {
                  const Icon = item.icon
                  const active = item.match(path)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSheetOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                        active ? 'bg-[var(--surface)] font-medium text-[var(--text)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  )
                })}
            </nav>

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* Language + logout */}
            <div className="p-4">
              <div className="flex rounded-xl border border-[var(--border-subtle)] p-1">
                {(['en', 'ru'] as const).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => setLanguage(lng)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium uppercase transition-colors ${
                      language === lng
                        ? 'bg-[var(--surface)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
            </div>

            {isAuthenticated ? (
              <button
                onClick={() => { logout(); setSheetOpen(false) }}
                className="flex w-full items-center gap-3 px-7 py-4 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                <IoLogOutOutline className="h-[18px] w-[18px]" />
                {t('logout') || 'Log out'}
              </button>
            ) : (
              <button
                onClick={() => { redirectToNonsLogin(); setSheetOpen(false) }}
                className="flex w-full items-center justify-center gap-2 px-5 py-4 text-sm font-medium text-nonsprimary"
              >
                <IoLogInOutline className="h-[18px] w-[18px]" />
                {t('login') || 'Sign in'}
              </button>
            )}

            {/* Safe area spacer */}
            <div className="pb-safe h-4" />
          </div>
        </>
      )}
    </>
  )

  function Avatar({ display, big }: { display: { handle: string; name: string; avatar: string }; big?: boolean }) {
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
  const [params] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const [expanded, setExpanded] = useState(false)
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
