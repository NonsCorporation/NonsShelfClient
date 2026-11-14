'use client'

import Layout from '../components/layout/Layout'
import GlowingHorizon from '../components/badges/GlowingHorizon'
import { useLanguage } from '../contexts/LanguageContext'
import { notFound } from 'next/navigation'
import BannerShowcase from '../components/horizon/BannerShowcase'
import HorizonSubscription from '../components/horizon/HorizonSubscription'
import NameShowcase from '../components/horizon/NameShowcase'
import { HORIZON_ON } from '../lib/horizon'

// /horizon — what Horizon is, joining it (a Polar checkout), your Horizon state
// and payment history, and what it changes: the icon by your name and the banner.
export default function Horizon() {
  const { t } = useLanguage()
  // Horizon is switched off at build time: there is no such page.
  if (!HORIZON_ON) notFound()

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <GlowingHorizon className="h-8 w-8" />
          <h1 className="text-xl font-bold text-[var(--text)]">Horizon</h1>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-[var(--text)]">{t('horizonDesc')}</p>
        {/* Join, your status, manage the subscription, payment history */}
        <HorizonSubscription />

        <NameShowcase />
        <BannerShowcase />

        {/* The last word */}
        <p className="mb-4 mt-14 text-center text-lg font-medium leading-snug text-[var(--text)] sm:text-xl">
          {t('horizonFinallyPre')} <span className="font-semibold text-nonsprimaryfocus">{t('horizonFinallyYou')}</span> {t('horizonFinallyMid')}{' '}
          <em className="font-semibold italic text-[#f5a623]">{t('horizonFinallyGrow')}</em>.
        </p>
      </div>
    </Layout>
  )
}
