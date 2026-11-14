'use client'

import Layout from '../components/layout/Layout'
import GlowingHorizon from '../components/badges/GlowingHorizon'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { notFound } from 'next/navigation'
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
      <div className="mx-auto max-w-xl">
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
      </div>
    </Layout>
  )
}
