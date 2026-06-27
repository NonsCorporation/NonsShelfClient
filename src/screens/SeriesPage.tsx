'use client'

import { useEffect, useState } from 'react'
import { useParams, Link } from '@/lib/router'
import { IoLayersOutline } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import { connectionService } from '../services/connectionService'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'
import type { SeriesPageData } from '../types'

// Public page for a series (/series/<uuid>): the ordered list of works, Goodreads
// "Book N of M" style. Books or films — the series' `type` drives the medium.
export default function SeriesScreen() {
  const { t } = useLanguage()
  const { uuid = '' } = useParams<{ uuid: string }>()
  const [data, setData] = useState<SeriesPageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    connectionService.getSeries(uuid).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [uuid])

  if (loading) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div></Layout>
  }
  if (!data) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound')}</div></Layout>
  }

  const { series, items } = data

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)]">
          <IoLayersOutline className="h-5 w-5 text-nonsprimary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t('seriesTitle') || 'Series'}
            {series.role && series.role !== 'main' ? ` · ${t(`role_${series.role}`) || series.role}` : ''}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text)]">{series.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('seriesEntries', { n: items.length })}</p>
          {series.description && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{series.description}</p>
          )}
        </div>
      </div>

      {/* Ordered entries */}
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">{t('noEntriesYet') || 'No entries yet.'}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.media.id}>
              <Link
                to={mediaPath({ type: it.media.type, uuid: it.media.uuid, id: String(it.media.id) })}
                className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-nonsprimary/50"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-bold text-[var(--text-muted)]">
                  {it.label ? '–' : it.position}
                </span>
                <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--container-2)]">
                  {it.media.cover_url && <img src={it.media.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  {it.label && (
                    <span className="mb-0.5 inline-block rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {t(`role_${it.label}`) || it.label}
                    </span>
                  )}
                  <p className="truncate font-semibold text-[var(--text)]">{it.media.title}</p>
                  <p className="truncate text-sm text-[var(--text-muted)]">
                    {[it.media.author || it.media.director, it.media.year || undefined].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Layout>
  )
}
