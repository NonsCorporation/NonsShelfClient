'use client'

import { useEffect } from 'react'
import { IoArrowBack } from 'react-icons/io5'
import { Link, useNavigate, useParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ProfileEditor from '../components/profile/ProfileEditor'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { userPath } from '../lib/paths'

// /u/<handle>/edit — the editor for your own profile. The form itself lives in
// ProfileEditor (shared with the post-signup welcome step).
export default function EditProfile() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()

  const isOwn = !!user && (routeId === user.username || routeId === user.uuid)
  const profileHref = userPath(routeId ?? user?.username ?? '')

  // Only your own profile is editable — anyone else lands back on the profile.
  useEffect(() => {
    if (authLoading) return
    if (user && !isOwn) navigate(profileHref, { replace: true })
  }, [authLoading, user, isOwn, navigate, profileHref])

  if (authLoading || !user || !isOwn) {
    return (
      <Layout>
        <div className="py-24 text-center text-sm text-[var(--text-muted)]">{t('loading') || '…'}</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <Link
          to={profileHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IoArrowBack className="h-4 w-4" />
          {t('editProfileBackToProfile')}
        </Link>

        <h1 className="mb-8 text-2xl font-bold tracking-tight text-[var(--text)]">{t('editProfileTitle')}</h1>

        <ProfileEditor mode="edit" cancelHref={profileHref} onDone={(username) => navigate(userPath(username))} />
      </div>
    </Layout>
  )
}
