'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from '@/lib/router'
import { IoSparklesOutline, IoLayersOutline } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import { connectionService } from '../services/connectionService'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'
import type { FranchisePageData } from '../types'

// Public page for a franchise / universe (/franchise/<uuid>): the sibling series
// it groups, and the full list of member works in franchise order (grouped by
// saga / phase when present).
export default function FranchiseScreen() {
  const { t } = useLanguage()
  const { uuid = '' } = useParams<{ uuid: string }>()
  const [data, setData] = useState<FranchisePageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    connectionService.getFranchise(uuid).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [uuid])

  // Group members by saga (in first-seen order), so "Phase 1/2/3" sections form
  // naturally; members without a saga fall under a single untitled group.
  const groups = useMemo(() => {
    if (!data) return []
    const order: string[] = []
    const map = new Map<string, FranchisePageData['members']>()
    for (const m of data.members) {
      const key = m.saga || ''
      if (!map.has(key)) { map.set(key, []); order.push(key) }
      map.get(key)!.push(m)
    }
    return order.map((key) => ({ saga: key, members: map.get(key)! }))
  }, [data])

  if (loading) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div></Layout>
  }
  if (!data) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound')}</div></Layout>
  }

  const { franchise, series } = data

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)]">
          <IoSparklesOutline className="h-5 w-5 text-nonsprimary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('franchiseTitle') || 'Universe'}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text)]">{franchise.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('franchiseWorks', { n: data.members.length })}</p>
          {franchise.description && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{franchise.description}</p>
          )}
        </div>
      </div>

      {/* Sibling series */}
      {series.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {t('spinoffsAndMore') || 'Series in this universe'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {series.map((s) => (
              <Link
                key={s.id}
                to={`/series/${s.uuid}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
              >
                <IoLayersOutline className="h-3.5 w-3.5" />
                {s.name}
                {s.role && s.role !== 'main' && (
                  <span className="opacity-60">· {t(`role_${s.role}`) || s.role}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Member works, grouped by saga */}
      {groups.map((g) => (
        <div key={g.saga || 'all'} className="mb-8">
          {g.saga && (
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">{g.saga}</h2>
          )}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {g.members.map((m) => (
              <Link
                key={m.media.id}
                to={mediaPath({ type: m.media.type, uuid: m.media.uuid, id: String(m.media.id) })}
                className="group"
                title={m.media.title}
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)]">
                  {m.media.cover_url && <img src={m.media.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                  {m.role && m.role !== 'main' && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                      {m.role}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-[var(--text)]">{m.media.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{m.media.year || ' '}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </Layout>
  )
}
