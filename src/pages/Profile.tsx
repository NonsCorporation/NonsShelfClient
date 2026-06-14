import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { libraryService } from '../services/libraryService'
import { fetchPublicProfile } from '../services/userService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { currentUser, initials, colorFor } from '../lib/user'
import { mediaPath } from '../lib/paths'

type ProfileView = {
  name: string
  handle: string
  color: string
  avatar: string
}

export default function ProfilePage() {
  const { t } = useLanguage()
  const { id: routeId } = useParams<{ id: string }>()
  const { user: authUser, loading: authLoading } = useAuth()

  const [items, setItems] = useState<MediaItem[]>([])
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [isSelf, setIsSelf] = useState(true)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Resolve whose profile this is. The route is /u/<username|uuid>: when it
  // matches the signed-in user (or is absent) it's their own; otherwise resolve
  // the username against nons-server (the identity provider) and pull that
  // user's public library by the shared numeric id.
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    const mine = !routeId || routeId === authUser?.username || routeId === authUser?.uuid

    async function load() {
      if (mine) {
        const its = await libraryService.getItems()
        if (cancelled) return
        setIsSelf(true)
        setProfile({
          name: authUser?.name || authUser?.username || currentUser.name,
          handle: authUser?.username ?? currentUser.handle,
          color: currentUser.color,
          avatar: authUser?.avatar_url || '',
        })
        setItems(its)
      } else {
        const p = await fetchPublicProfile(routeId!)
        if (cancelled) return
        if (!p) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setIsSelf(false)
        setProfile({
          name: p.name,
          handle: p.username,
          color: colorFor(p.username),
          avatar: p.avatarUrl || '',
        })
        const its = await libraryService.getUserItems(p.id)
        if (cancelled) return
        setItems(its)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [routeId, authUser, authLoading])

  const stats = useMemo(() => {
    const rated = items.filter((it) => typeof it.rating === 'number' && it.rating > 0)
    const avg = rated.length ? rated.reduce((s, it) => s + (it.rating || 0), 0) / rated.length / 2 : 0
    const base = [
      { label: t('statTotal'), value: items.length },
      { label: t('statBooks'), value: items.filter((it) => it.type === 'book').length },
      { label: t('statMovies'), value: items.filter((it) => it.type === 'movie').length },
      { label: t('seriesPlural'), value: items.filter((it) => it.type === 'series').length },
      { label: t('statFinished'), value: items.filter((it) => it.status === 'done').length },
      { label: t('statAvg'), value: avg ? avg.toFixed(1) : '—' },
    ]
    // Favorites are only fetched for the signed-in user (others' stay private).
    if (isSelf) {
      base.splice(4, 0, { label: t('favorites'), value: items.filter((it) => it.favorite).length })
    }
    return base
  }, [items, isSelf, t])

  const recent = useMemo(
    () => [...items].sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')).slice(0, 6),
    [items],
  )

  if (loading) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div>
      </Layout>
    )
  }

  if (notFound || !profile) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('userNotFound')}</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex items-center gap-5">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.name}
            className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white"
            style={{ backgroundColor: profile.color }}
          >
            {initials(profile.name)}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{profile.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">@{profile.handle}</p>
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
              <Link key={it.id} to={mediaPath(it)} className="group block" title={it.title}>
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
