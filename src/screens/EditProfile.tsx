'use client'

import { useEffect } from 'react'
import { IoArrowBack, IoLockClosedOutline, IoPersonOutline } from 'react-icons/io5'
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import ProfileEditor from '../components/profile/ProfileEditor'
import PrivacySettings from '../components/settings/PrivacySettings'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { userPath } from '../lib/paths'

type TabKey = 'profile' | 'privacy'

// /u/<handle>/edit — your profile and who can see it, in one place. Two tabs
// (kept in the URL: ?tab=privacy): the profile form (shared with the post-signup
// welcome step, saved with its own button) and the privacy settings (applied the
// moment they change). Both stay mounted, so switching tabs never drops
// half-typed profile edits.
export default function EditProfile() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()

  const tab: TabKey = params.get('tab') === 'privacy' ? 'privacy' : 'profile'
  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(params)
    if (next === 'privacy') p.set('tab', 'privacy')
    else p.delete('tab')
    setParams(p, { replace: true })
  }

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

  const tabs: { key: TabKey; label: string; icon: typeof IoPersonOutline }[] = [
    { key: 'profile', label: t('editProfileTabProfile'), icon: IoPersonOutline },
    { key: 'privacy', label: t('editProfileTabPrivacy'), icon: IoLockClosedOutline },
  ]

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <Link
          to={profileHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IoArrowBack className="h-4 w-4" />
          {t('editProfileBackToProfile')}
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t('editProfileTitle')}</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--text-muted)]">{t('editProfileSubtitle')}</p>

        {/* Tabs — segmented, same look as the other pill controls. */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1" role="tablist">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-[var(--container)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-nonsprimary' : ''}`} />
                {label}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" hidden={tab !== 'profile'}>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5 sm:p-7">
            <ProfileEditor mode="edit" cancelHref={profileHref} onDone={(username) => navigate(userPath(username))} />
          </div>
        </div>

        <div role="tabpanel" hidden={tab !== 'privacy'} className="animate-fade-up">
          <PrivacySettings />
        </div>
      </div>
    </Layout>
  )
}
