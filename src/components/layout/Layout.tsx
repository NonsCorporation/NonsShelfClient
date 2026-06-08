import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IoMenu, IoSearch, IoAdd } from 'react-icons/io5'
import Sidebar from './Sidebar'
import { useLanguage } from '../../contexts/LanguageContext'

type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useLanguage()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  // Global search: lives in the top bar on every page and always resolves to the
  // Library with a `?q=` param, preserving the current shelf if there is one.
  const onSearch = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    const search = next.toString()
    navigate({ pathname: '/', search: search ? `?${search}` : '' }, { replace: true })
  }

  // Adding is also routed (so the action works from any page): the Library
  // reads `?add=` and opens the modal.
  const onAdd = () => navigate('/?add=book')

  return (
    <div className="app-ambient relative min-h-screen">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="lg:pl-60">
        {/* Global top bar */}
        <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text)] lg:hidden"
              aria-label="Open menu"
            >
              <IoMenu className="h-5 w-5" />
            </button>

            <div className="relative min-w-0 flex-1 md:max-w-md">
              <IoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={q}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t('globalSearch')}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] pl-11 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </div>

            <button
              onClick={onAdd}
              className="ml-auto inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-xl bg-nonsprimary px-3.5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              <IoAdd className="h-5 w-5" />
              <span className="hidden sm:inline">{t('addEntry')}</span>
            </button>
          </div>
        </header>

        <main className="relative z-10">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
