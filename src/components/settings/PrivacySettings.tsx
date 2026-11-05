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
import { Row, SegmentedSelect, Switch, type Option } from './ui'

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
