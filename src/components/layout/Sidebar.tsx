import { Link, useLocation, useSearchParams } from '@/lib/router'
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
  IoClose,
  IoEyeOutline,
  IoEyeOffOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { IoLogOutOutline, IoLogInOutline } from 'react-icons/io5'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { useAuth } from '../../contexts/AuthContext'
import { initials, colorFor } from '../../lib/user'
import { redirectToNonsLogin } from '../../lib/api'
import { userPath } from '../../lib/paths'
import { FaCrown } from 'react-icons/fa6'
import { isLibrarian } from '../../services/librarianService'

type ShelfKey = 'all' | 'wishlist' | 'active' | 'done' | 'favorites'

type SidebarProps = {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const [params] = useSearchParams()
  const { language, setLanguage, t } = useLanguage()
  const { showInProgress, setShowInProgress } = usePreferences()
  const { user, logout, isAuthenticated, loading } = useAuth()

  // The signed-in nons identity. Null when logged out (possible on the public
  // /b and /m pages, which have no auth gate) — the account section at the
  // bottom renders a Sign in button in that case instead of a mock user.
  // Profile links go by username (/u/<username>) so they resolve against
  // nons-server's public-profile lookup; uuid is a fallback for older tokens.
  const display = user
    ? {
        handle: user.username,
        profileId: user.username || user.uuid || '',
        name: user.name || user.username,
        avatar: user.avatar_url || '',
      }
    : null

  const activeShelf = (params.get('shelf') as ShelfKey) || 'all'
  const onLibrary = location.pathname === '/library'

  const shelves: { key: ShelfKey; label: string; icon: IconType; dot?: string }[] = [
    { key: 'all', label: t('allItems'), icon: IoLayersOutline },
    { key: 'wishlist', label: t('shelfWishlist'), icon: IoBookmarkOutline, dot: '#6768ab' },
    { key: 'active', label: t('shelfActive'), icon: IoTimeOutline, dot: '#f5a623' },
    { key: 'done', label: t('shelfDone'), icon: IoCheckmarkDoneOutline, dot: '#3ec98a' },
    { key: 'favorites', label: t('favorites'), icon: IoHeartOutline, dot: '#ff7a85' },
  ]

  const content = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      {/* Brand */}
      <Link to="/" onClick={onClose} className="flex items-center gap-2.5 px-2 py-1">
        <img src="/logo.png" alt="Nons Shelf" className="h-5 w-5 text-nonsprimary" />
        <p className="text-sm font-semibold tracking-tight text-[var(--text)]">Nons Shelf</p>
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t('browse')}
        </p>
        <Link
          to="/"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            location.pathname === '/'
              ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoHomeOutline className="h-[18px] w-[18px]" />
          {t('home')}
        </Link>
        <Link
          to="/library"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            onLibrary
              ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoLibraryOutline className="h-[18px] w-[18px]" />
          {t('library')}
        </Link>
        <Link
          to="/discover"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            location.pathname === '/discover'
              ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoCompassOutline className="h-[18px] w-[18px]" />
          {t('discover')}
        </Link>
        <Link
          to="/calendar"
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            location.pathname === '/calendar'
              ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IoCalendarOutline className="h-[18px] w-[18px]" />
          {t('calendar')}
        </Link>

        {isLibrarian(user?.role) && (
          <Link
            to="/librarians"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              location.pathname.startsWith('/librarian')
                ? 'bg-[var(--surface)] font-medium text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <FaCrown className="h-[18px] w-[18px]" />
            {t('librarians')}
          </Link>
        )}
      </nav>

      {/* Shelves */}
      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t('shelves')}
        </p>
        {shelves.map((s) => {
          const active = onLibrary && activeShelf === s.key
          const Icon = s.icon
          return (
            <div key={s.key} className="relative">
              <Link
                to={s.key === 'all' ? '/library' : `/library?shelf=${s.key}`}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  s.key === 'active' ? 'pr-9' : ''
                } ${
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

              {/* Toggle visibility of the "In progress" section on the Library */}
              {s.key === 'active' && (
                <button
                  onClick={() => setShowInProgress(!showInProgress)}
                  title={showInProgress ? t('hide') : t('show')}
                  className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)] ${
                    showInProgress ? 'text-[var(--text-muted)] hover:text-[var(--text)]' : 'text-nonsprimary'
                  }`}
                >
                  {showInProgress ? <IoEyeOutline className="h-4 w-4" /> : <IoEyeOffOutline className="h-4 w-4" />}
                </button>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: language toggle + user */}
      <div className="mt-auto flex flex-col gap-2">
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
              onClick={onClose}
              title={t('viewProfile')}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface)]"
            >
              {display.avatar ? (
                <img
                  src={display.avatar}
                  alt={display.name}
                  className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: colorFor(display.handle) }}
                >
                  {initials(display.name)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--text)]">{display.name}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">@{display.handle}</span>
              </span>
            </Link>
            <button
              onClick={() => logout()}
              title={t('logout') || 'Log out'}
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
    </div>
  )

  return (
    <>
      {/* Desktop: fixed rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-[var(--border-subtle)] bg-[var(--sidebar)] lg:block">
        {content}
      </aside>

      {/* Mobile: slide-over drawer */}
      <div className={`lg:hidden ${open ? '' : 'pointer-events-none'}`}>
        <div
          onClick={onClose}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--border-subtle)] bg-[var(--sidebar)] transition-transform duration-300 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
          {content}
        </aside>
      </div>
    </>
  )
}
