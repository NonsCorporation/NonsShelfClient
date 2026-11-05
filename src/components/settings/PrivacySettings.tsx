'use client'

import { useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
import {
  IoChatbubblesOutline,
  IoEarthOutline,
  IoLibraryOutline,
  IoLockClosedOutline,
  IoPeopleOutline,
  IoPersonAddOutline,
  IoPulseOutline,
  IoStarOutline,
  IoSparklesOutline,
} from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  usePreferences,
  PRIVACY_FACETS,
  type PrivacyFacet,
  type Visibility,
} from '@/contexts/PreferencesContext'
import { chatApi, type MessagePrivacy } from '@/services/chatService'

type Option<K extends string> = { key: K; labelKey: string; hintKey: string; icon: IconType }

// Visibility options, narrowest audience first: private → friends → public.
const VIS_OPTIONS: Option<Visibility>[] = [
  { key: 'nobody', labelKey: 'visibilityNobody', hintKey: 'visibilityNobodyHint', icon: IoLockClosedOutline },
  { key: 'friends', labelKey: 'visibilityFriends', hintKey: 'visibilityFriendsHint', icon: IoPeopleOutline },
  { key: 'everyone', labelKey: 'visibilityEveryone', hintKey: 'visibilityEveryoneHint', icon: IoEarthOutline },
]

// "Who can message me" — same control, one extra rung (people you follow).
const MSG_OPTIONS: Option<MessagePrivacy>[] = [
  { key: 'nobody', labelKey: 'visibilityNobody', hintKey: 'msgPrivacyNobodyHint', icon: IoLockClosedOutline },
  { key: 'friends', labelKey: 'visibilityFriends', hintKey: 'msgPrivacyFriendsHint', icon: IoPeopleOutline },
  { key: 'following', labelKey: 'msgPrivacyFollowing', hintKey: 'msgPrivacyFollowingHint', icon: IoPersonAddOutline },
  { key: 'everyone', labelKey: 'visibilityEveryone', hintKey: 'msgPrivacyEveryoneHint', icon: IoEarthOutline },
]

const FACET_META: Record<PrivacyFacet, { labelKey: string; hintKey: string; icon: IconType }> = {
  shelf: { labelKey: 'privacyShelf', hintKey: 'privacyShelfHint', icon: IoLibraryOutline },
  ratings: { labelKey: 'privacyRatings', hintKey: 'privacyRatingsHint', icon: IoStarOutline },
  activity: { labelKey: 'privacyActivity', hintKey: 'privacyActivityHint', icon: IoPulseOutline },
}

// Who can see what: the shelf / ratings / activity facets, who may message you,
// and whether your reactions surface in friends' feeds. Everything saves the
// moment it changes (facets and reactions through PreferencesContext, messages
// straight to the chat API), so there is no Save button.
export default function PrivacySettings() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { privacy, setVisibility, showActivityReactions, setShowActivityReactions } = usePreferences()

  // "Who can message me" is enforced server-side; null until loaded, and the
  // row stays hidden if it fails.
  const [msgPrivacy, setMsgPrivacy] = useState<MessagePrivacy | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    chatApi.getPrivacy().then((r) => {
      if (!cancelled && r.ok) setMsgPrivacy(r.data.message_privacy)
    })
    return () => { cancelled = true }
  }, [user])

  const changeMsgPrivacy = async (v: MessagePrivacy) => {
    const prev = msgPrivacy
    if (v === prev) return
    setMsgPrivacy(v)
    const r = await chatApi.setPrivacy(v)
    if (!r.ok) setMsgPrivacy(prev)
  }

  return (
    <div className="flex flex-col gap-3">
      {PRIVACY_FACETS.map((facet) => {
        const meta = FACET_META[facet]
        return (
          <Row key={facet} icon={meta.icon} title={t(meta.labelKey)} hint={t(meta.hintKey)}>
            <SegmentedSelect options={VIS_OPTIONS} value={privacy[facet]} onChange={(v) => setVisibility(facet, v)} />
          </Row>
        )
      })}

      {msgPrivacy && (
        <Row icon={IoChatbubblesOutline} title={t('privacyMessages')} hint={t('privacyMessagesHint')}>
          <SegmentedSelect options={MSG_OPTIONS} value={msgPrivacy} onChange={(v) => void changeMsgPrivacy(v)} />
        </Row>
      )}

      <Row
        icon={IoSparklesOutline}
        title={t('settingsShowActivityReactions')}
        hint={t('settingsShowActivityReactionsHint')}
        aside={<Switch checked={showActivityReactions} onChange={setShowActivityReactions} label={t('settingsShowActivityReactions')} />}
      />

      <p className="px-1 text-xs text-[var(--text-muted)]">{t('privacyAutosaved')}</p>
    </div>
  )
}

// One setting: an icon tile, title + hint, and either a control below (children)
// or a compact one beside the text (aside).
function Row({
  icon: Icon,
  title,
  hint,
  aside,
  children,
}: {
  icon: IconType
  title: string
  hint: string
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{hint}</p>
        </div>
        {aside}
      </div>
      {children && <div className="sm:w-[26rem] sm:flex-shrink-0">{children}</div>}
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-1 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-nonsprimary' : 'bg-[var(--border-strong)]'}`}
    >
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SegmentedSelect<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<K>[]
  value: K
  onChange: (v: K) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="flex gap-1 rounded-xl bg-[var(--surface)] p-1" role="radiogroup">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            title={t(opt.hintKey)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--container)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-nonsprimary' : ''} ${options.length > 3 ? 'hidden sm:block' : ''}`} />
            {t(opt.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
