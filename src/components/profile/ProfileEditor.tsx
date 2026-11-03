'use client'

import { useEffect, useRef, useState } from 'react'
import { IoDiceOutline, IoGlobeOutline, IoLockClosedOutline, IoPeopleOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import BoringAvatar from '@/components/ui/BoringAvatar'
import EditableAvatar from '@/components/profile/EditableAvatar'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import { BIO_MAX, NAME_MAX, buildProfilePatch, formFromAccount, imageToBlob, type ProfileForm, type Visibility } from '@/lib/profile'
import { removeAvatar, renewSession, suggestUsername, updateMyProfile, uploadAvatar } from '@/services/profileService'
import { COUNTRIES } from '@/lib/countries'
import { USERNAME_MAX_LENGTH, isAutoUsername, sanitizeUsername, usernameError, type UsernameError } from '@/lib/username'

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
    { value: 'friends', label: t('visibilityFriends'), icon: IoPeopleOutline },
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

type Props = {
  /** 'edit' = the profile edit page; 'welcome' = the one-time step after signing up. */
  mode: 'edit' | 'welcome'
  /** Runs after a successful save, with the username the account has now — it
   *  may just have been changed. */
  onDone: (username: string) => void
  /** Where Cancel goes (edit mode). */
  cancelHref?: string
}

// The profile form shared by the edit page and the post-signup welcome step —
// photo, name, username, bio, location with visibility switches. Everything is
// saved to the server (PUT /api/me/profile, PUT|DELETE /api/me/avatar).
//
// In welcome mode it is the mandatory step after signing up, as in nons: there
// is no skip, the first name and a username are required (photo, bio and
// location stay optional), and a still-generated handle starts out empty so the
// person picks their own.
export default function ProfileEditor({ mode, onDone, cancelHref = '/' }: Props) {
  const { t } = useLanguage()
  const { user, refreshUser } = useAuth()

  const [form, setForm] = useState<ProfileForm | null>(null)
  const [usernameErr, setUsernameErr] = useState<string | null>(null)
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rolling, setRolling] = useState(false)

  // The photo is staged until Save: a freshly picked image (and its preview), or
  // a request to remove the current one.
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)

  // Seed the form once from the account. (Not on every `user` change: a refresh
  // mid-edit must not wipe what's being typed.)
  const seeded = useRef(false)
  useEffect(() => {
    if (!user || seeded.current) return
    seeded.current = true
    const initial = formFromAccount(user)
    if (mode === 'welcome' && isAutoUsername(user.username)) initial.username = ''
    setForm(initial)
  }, [user, mode])

  // Release the preview's object URL when it's replaced or the editor closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  if (!user || !form) {
    return <div className="py-16 text-center text-sm text-[var(--text-muted)]">{t('loading') || '…'}</div>
  }

  const patch = (p: Partial<ProfileForm>) => setForm((f) => (f ? { ...f, ...p } : f))

  const accountName = user.name || user.username
  const shownAvatar = removePhoto ? '' : preview || user.avatar_url || ''

  const onPickPhoto = async (file: File) => {
    try {
      const blob = await imageToBlob(file)
      setNewPhoto(blob)
      setPreview(URL.createObjectURL(blob))
      setRemovePhoto(false)
    } catch {
      /* not an image — ignore */
    }
  }
  const onResetPhoto = () => {
    setNewPhoto(null)
    setPreview(null)
    setRemovePhoto(true)
  }

  // The dice: ask the server for a random free username and drop it in.
  const onRoll = async () => {
    if (rolling) return
    setRolling(true)
    const name = await suggestUsername()
    setRolling(false)
    if (name) {
      patch({ username: name })
      setUsernameErr(null)
    } else {
      setUsernameErr(t('editProfileDiceFailed'))
    }
  }

  const onSave = async () => {
    if (busy) return
    setSaveErr(null)
    setNameErr(null)
    const err = usernameError(form.username)
    if (err) {
      setUsernameErr(t(USERNAME_ERROR_KEY[err]))
      return
    }
    if (!form.firstName.trim()) {
      setNameErr(t('editProfileFirstNameRequired'))
      return
    }

    setBusy(true)
    try {
      // 1. Photo (separate endpoint).
      if (newPhoto || (removePhoto && user.avatar_url)) {
        const r = newPhoto ? await uploadAvatar(newPhoto) : await removeAvatar()
        if (!r.ok) {
          setSaveErr(t('editProfilePhotoFailed'))
          return
        }
      }

      // 2. Fields — only what changed, plus "welcome step done".
      const res = await updateMyProfile(buildProfilePatch(form, user))
      if (!res.ok) {
        if (res.field === 'username') setUsernameErr(res.status === 409 ? t('usernameErrTaken') : res.error)
        else if (res.field === 'first_name' || res.field === 'last_name') setNameErr(res.error)
        else setSaveErr(res.error || t('editProfileSaveFailed'))
        return
      }

      // 3. Session tokens carry the username: renew them after a rename, then
      // re-read /api/me so the whole app shows the new values.
      if (form.username !== user.username) await renewSession()
      await refreshUser()
      onDone(form.username)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Photo */}
      <section className="mb-8 flex items-center gap-5 border-b border-[var(--border-subtle)] pb-8">
        <EditableAvatar
          editable
          hasCustom={!!shownAvatar}
          onPick={onPickPhoto}
          onReset={onResetPhoto}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="ep-first" className="text-sm font-medium text-[var(--text)]">{t('authFirstName')}</label>
              <input
                id="ep-first"
                type="text"
                value={form.firstName}
                maxLength={NAME_MAX}
                autoComplete="given-name"
                autoFocus={mode === 'welcome'}
                onChange={(e) => { patch({ firstName: e.target.value }); setNameErr(null) }}
                className={`${INPUT} ${nameErr ? 'border-red-500' : 'border-[var(--border-subtle)]'}`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ep-last" className="text-sm font-medium text-[var(--text)]">{t('authLastName')}</label>
              <input
                id="ep-last"
                type="text"
                value={form.lastName}
                maxLength={NAME_MAX}
                autoComplete="family-name"
                onChange={(e) => patch({ lastName: e.target.value })}
                className={`${INPUT} border-[var(--border-subtle)]`}
              />
            </div>
          </div>
          {nameErr && <p className="text-xs text-red-500">{nameErr}</p>}
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
              placeholder="username"
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
              className={`${INPUT} pl-8 pr-12 font-mono ${usernameErr ? 'border-red-500' : 'border-[var(--border-subtle)]'}`}
            />
            <button
              type="button"
              onClick={onRoll}
              disabled={rolling || busy}
              aria-label={t('editProfileDice')}
              title={t('editProfileDice')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-nonsprimary disabled:opacity-50"
            >
              <IoDiceOutline className={`h-5 w-5 ${rolling ? 'animate-spin' : ''}`} />
            </button>
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
        <div role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{saveErr}</div>
      )}

      <div className="mt-10 flex gap-3 border-t border-[var(--border-subtle)] pt-6">
        {mode === 'edit' && (
          <Link
            to={cancelHref}
            className="flex flex-1 items-center justify-center rounded-full border border-[var(--border-subtle)] px-6 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            {t('cancel')}
          </Link>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !!usernameErr}
          className="flex-1 rounded-full bg-nonsprimary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('saving') : mode === 'welcome' ? t('welcomeContinue') : t('save')}
        </button>
      </div>
    </>
  )
}
