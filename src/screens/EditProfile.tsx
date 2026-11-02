'use client'

import { useEffect, useState } from 'react'
import { IoArrowBack, IoGlobeOutline, IoLockClosedOutline } from 'react-icons/io5'
import { Link, useNavigate, useParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import BoringAvatar from '@/components/ui/BoringAvatar'
import EditableAvatar from '@/components/profile/EditableAvatar'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import {
  BIO_MAX,
  imageToDataUrl,
  loadProfileCustomization,
  useProfileCustomization,
  type Visibility,
} from '../lib/profileCustomization'
import { COUNTRIES } from '../lib/countries'
import { USERNAME_MAX_LENGTH, sanitizeUsername, usernameError, type UsernameError } from '../lib/username'
import { userPath } from '../lib/paths'

type Form = {
  name: string
  username: string
  bio: string
  country: string
  city: string
  bioVisibility: Visibility
  locationVisibility: Visibility
  /** Staged custom photo (data URL); undefined = fall back to the account photo. */
  avatar?: string
}

const USERNAME_ERROR_KEY: Record<UsernameError, string> = {
  required: 'usernameErrRequired',
  short: 'usernameErrShort',
  long: 'usernameErrLong',
  start: 'usernameErrStart',
  chars: 'usernameErrChars',
  reserved: 'usernameErrReserved',
  idLike: 'usernameErrIdLike',
}

const INPUT =
  'w-full rounded-xl border bg-[var(--container)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-nonsprimary transition-colors'

function VisibilityToggle({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const { t } = useLanguage()
  const options: { value: Visibility; label: string; icon: typeof IoGlobeOutline }[] = [
    { value: 'public', label: t('visibilityEveryone'), icon: IoGlobeOutline },
    { value: 'private', label: t('visibilityNobody'), icon: IoLockClosedOutline },
  ]
  return (
    <div className="flex gap-1" role="group">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={label}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
            value === v
              ? 'bg-nonsprimary text-white'
              : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function EditProfile() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const { update } = useProfileCustomization(user?.id)

  const [form, setForm] = useState<Form | null>(null)
  const [usernameErr, setUsernameErr] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const isOwn = !!user && (routeId === user.username || routeId === user.uuid)
  const profileHref = userPath(routeId ?? user?.username ?? '')

  // Only your own profile is editable — anyone else lands back on the profile.
  useEffect(() => {
    if (authLoading) return
    if (user && !isOwn) navigate(profileHref, { replace: true })
  }, [authLoading, user, isOwn, navigate, profileHref])

  // Seed the form once, from what's stored (or the account defaults). Read
  // straight from storage: the hook's own copy only fills in after mount.
  useEffect(() => {
    if (!user || !isOwn) return
    const c = loadProfileCustomization(user.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: c.name ?? user.name ?? user.username,
      username: c.username ?? user.username,
      bio: c.bio ?? '',
      country: c.country ?? '',
      city: c.city ?? '',
      bioVisibility: c.bioVisibility ?? 'public',
      locationVisibility: c.locationVisibility ?? 'public',
      avatar: c.avatar,
    })
  }, [user, isOwn])

  if (authLoading || !user || !isOwn || !form) {
    return (
      <Layout>
        <div className="py-24 text-center text-sm text-[var(--text-muted)]">{t('loading') || '…'}</div>
      </Layout>
    )
  }

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f))

  const accountName = user.name || user.username
  const shownAvatar = form.avatar || user.avatar_url || ''

  const onPickPhoto = async (file: File) => {
    try {
      patch({ avatar: await imageToDataUrl(file, 256, 256) })
    } catch {
      /* not an image — ignore */
    }
  }

  const onSave = () => {
    setSaveErr(null)
    const err = usernameError(form.username)
    if (err) {
      setUsernameErr(t(USERNAME_ERROR_KEY[err]))
      return
    }
    const name = form.name.trim()
    const ok = update({
      // Matching the account value means "no override" — keeps following the account.
      name: name && name !== accountName ? name : undefined,
      username: form.username !== user.username ? form.username : undefined,
      bio: form.bio.trim() || undefined,
      country: form.country || undefined,
      city: form.city.trim() || undefined,
      bioVisibility: form.bioVisibility,
      locationVisibility: form.locationVisibility,
      avatar: form.avatar,
    })
    if (!ok) {
      setSaveErr(t('editProfileSaveFailed'))
      return
    }
    navigate(profileHref)
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

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-[var(--text)]">{t('editProfileTitle')}</h1>
        <p className="mb-8 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {t('editProfileMockNote')}
        </p>

        {/* Photo */}
        <section className="mb-8 flex items-center gap-5 border-b border-[var(--border-subtle)] pb-8">
          <EditableAvatar
            editable
            hasCustom={!!form.avatar}
            onPick={onPickPhoto}
            onReset={() => patch({ avatar: undefined })}
            changeLabel={t('editProfileChangePhoto')}
            resetLabel={t('editProfileResetPhoto')}
          >
            {shownAvatar ? (
              <img src={shownAvatar} alt={accountName} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <span className="block overflow-hidden rounded-full" style={{ width: 80, height: 80 }}>
                <BoringAvatar size={80} name={`user-${user.id}`} />
              </span>
            )}
          </EditableAvatar>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{t('editProfilePhoto')}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('editProfilePhotoHint')}</p>
          </div>
        </section>

        <div className="space-y-7">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="ep-name" className="text-sm font-medium text-[var(--text)]">{t('name')}</label>
            <input
              id="ep-name"
              type="text"
              value={form.name}
              maxLength={60}
              onChange={(e) => patch({ name: e.target.value })}
              className={`${INPUT} border-[var(--border-subtle)]`}
            />
          </div>

          {/* Username */}
          <div className="flex flex-col gap-2">
            <label htmlFor="ep-username" className="text-sm font-medium text-[var(--text)]">{t('editProfileUsername')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[var(--text-muted)]">@</span>
              <input
                id="ep-username"
                type="text"
                value={form.username}
                maxLength={USERNAME_MAX_LENGTH}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  const v = sanitizeUsername(e.target.value)
                  patch({ username: v })
                  // Live feedback only once there's something to judge, and not
                  // while a trailing "_" is just the first half of "my_name".
                  const err = v && !v.endsWith('_') ? usernameError(v) : null
                  setUsernameErr(err ? t(USERNAME_ERROR_KEY[err]) : null)
                }}
                className={`${INPUT} pl-8 font-mono ${usernameErr ? 'border-red-500' : 'border-[var(--border-subtle)]'}`}
              />
            </div>
            {usernameErr ? (
              <p className="text-xs text-red-500">{usernameErr}</p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">{t('editProfileUsernameHint')}</p>
            )}
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ep-bio" className="text-sm font-medium text-[var(--text)]">{t('bio')}</label>
              <VisibilityToggle value={form.bioVisibility} onChange={(v) => patch({ bioVisibility: v })} />
            </div>
            <textarea
              id="ep-bio"
              value={form.bio}
              rows={4}
              maxLength={BIO_MAX}
              placeholder={t('editProfileBioPlaceholder')}
              onChange={(e) => patch({ bio: e.target.value })}
              className={`${INPUT} resize-none border-[var(--border-subtle)]`}
            />
            <span className="self-end text-xs text-[var(--text-muted)]">{form.bio.length}/{BIO_MAX}</span>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ep-country" className="text-sm font-medium text-[var(--text)]">{t('editProfileLocation')}</label>
              <VisibilityToggle value={form.locationVisibility} onChange={(v) => patch({ locationVisibility: v })} />
            </div>
            <div className="flex gap-3">
              <select
                id="ep-country"
                value={form.country}
                onChange={(e) => patch({ country: e.target.value })}
                className={`${INPUT} flex-1 cursor-pointer border-[var(--border-subtle)]`}
              >
                <option value="">{t('editProfileCountry')}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                value={form.city}
                maxLength={80}
                placeholder={t('editProfileCity')}
                aria-label={t('editProfileCity')}
                onChange={(e) => patch({ city: e.target.value })}
                className={`${INPUT} flex-1 border-[var(--border-subtle)]`}
              />
            </div>
          </div>
        </div>

        {saveErr && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{saveErr}</div>
        )}

        <div className="mt-10 flex gap-3 border-t border-[var(--border-subtle)] pt-6">
          <Link
            to={profileHref}
            className="flex flex-1 items-center justify-center rounded-full border border-[var(--border-subtle)] px-6 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={!!usernameErr}
            className="flex-1 rounded-full bg-nonsprimary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </Layout>
  )
}
