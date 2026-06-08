import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { currentUser, initials } from '../lib/user'

export default function ProfilePage() {
  const { t } = useLanguage()
  const { handle } = useParams<{ handle: string }>()
  const [items, setItems] = useState<MediaItem[]>([])

  useEffect(() => {
    libraryService.getItems().then(setItems)
  }, [])

  // Only the signed-in user is mocked for now; fall back to them for any handle.
  const user = currentUser
  const displayHandle = handle ?? user.handle

  const stats = useMemo(() => {
    const rated = items.filter((it) => typeof it.rating === 'number' && it.rating > 0)
    const avg = rated.length ? rated.reduce((s, it) => s + (it.rating || 0), 0) / rated.length / 2 : 0
    return [
      { label: t('statTotal'), value: items.length },
      { label: t('statBooks'), value: items.filter((it) => it.type === 'book').length },
      { label: t('statMovies'), value: items.filter((it) => it.type === 'movie').length },
      { label: t('statFinished'), value: items.filter((it) => it.status === 'done').length },
      { label: t('favorites'), value: items.filter((it) => it.favorite).length },
      { label: t('statAvg'), value: avg ? avg.toFixed(1) : '—' },
    ]
  }, [items, t])

  const recent = useMemo(
    () => [...items].sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')).slice(0, 6),
    [items],
  )

  return (
    <Layout>
      <div className="flex items-center gap-5">
        <span
          className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
          style={{ backgroundColor: user.color }}
        >
          {initials(user.name)}
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">{user.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">@{displayHandle}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('profileSubtitle')}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] px-4 py-3">
            <p className="text-xl font-bold text-[var(--text)]">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-[var(--text)]">{t('sortAdded')}</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {recent.map((it) => (
              <Link key={it.id} to={`/shelf/${it.id}`} className="group block" title={it.title}>
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover:border-[var(--border)]">
                  {it.coverUrl && (
                    <img src={it.coverUrl} alt={it.title} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Layout>
  )
}
