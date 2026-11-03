'use client'

import { useEffect } from 'react'
import { useNavigate } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ProfileEditor from '../components/profile/ProfileEditor'
import ShelfLogo from '../components/branding/ShelfLogo'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { userPath } from '../lib/paths'

// /welcome — the one-time "finish setting up your profile" step shown after
// signing up (the OnboardingGate keeps new accounts here until it is saved).
// Same fields as the profile edit page; first name and username are required.
export default function FinishSignup() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Already done (or a server without the flag): nothing to finish here.
  const done = !!user && user.finished_introduction !== false
  useEffect(() => {
    if (done) navigate('/', { replace: true })
  }, [done, navigate])
  if (done) return null

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)]">
            <ShelfLogo className="h-7 w-7 text-[var(--text)]" />
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-[var(--text)]">{t('welcomeTitle')}</h1>
        <p className="mb-8 mt-2 text-center text-sm text-[var(--text-muted)]">{t('welcomeSubtitle')}</p>

        <ProfileEditor mode="welcome" onDone={(username) => navigate(userPath(username))} />
      </div>
    </Layout>
  )
}
