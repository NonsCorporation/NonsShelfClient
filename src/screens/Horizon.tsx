'use client'

import Layout from '../components/layout/Layout'
import GlowingHorizon from '../components/badges/GlowingHorizon'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { notFound } from 'next/navigation'
import BannerShowcase from '../components/horizon/BannerShowcase'
import NameShowcase from '../components/horizon/NameShowcase'
import { HORIZON_ON, isHorizon } from '../lib/horizon'

// /horizon — what Horizon is, and whether the viewer is a member. Joining is not
// open yet, so non-members just see that it is coming.
export default function Horizon() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const member = isHorizon(user?.role)
  // Horizon is switched off at build time: there is no such page.
  if (!HORIZON_ON) notFound()

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <GlowingHorizon className="h-8 w-8" />
          <h1 className="text-xl font-bold text-[var(--text)]">Horizon</h1>
        </div>
        <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <p className="text-sm leading-relaxed text-[var(--text)]">{t('horizonDesc')}</p>
          <p className={`text-sm font-medium ${member ? 'text-nonsprimary' : 'text-[var(--text-muted)]'}`}>
            {member ? t('horizonYou') : t('horizonSoon')}
          </p>
        </div>

        <NameShowcase />
        <BannerShowcase />

        {/* The last word */}
        <p className="mb-4 mt-14 text-center text-lg font-medium leading-snug text-[var(--text)] sm:text-xl">
          {t('horizonFinally')
            .split('SomeShelf')
            .map((part, i, parts) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && <span className="font-semibold text-nonsprimaryfocus">SomeShelf</span>}
              </span>
            ))}{' '}
          <em className="font-semibold italic text-[#f5a623]">{t('horizonFinallyGrow')}</em>.
        </p>
      </div>
    </Layout>
  )
}
