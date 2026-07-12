import {
  IoClose,
  IoLockClosedOutline,
  IoPeopleOutline,
  IoEarthOutline,
  IoLibraryOutline,
  IoStarOutline,
  IoPulseOutline,
  IoCloudUploadOutline,
  IoLogOutOutline,
  IoTrashOutline,
  IoOpenOutline,
} from 'react-icons/io5'
import { useState } from 'react'
import type { IconType } from 'react-icons'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSelect from '@/components/ui/LanguageSelect'
import NonsLogo from '@/components/branding/NonsLogo'
import {
  usePreferences,
  PRIVACY_FACETS,
  FEED_BLOCKS,
  type PrivacyFacet,
  type Visibility,
  type FeedBlock,
} from '@/contexts/PreferencesContext'
import { MEDIA_LANG_OPTIONS } from '@/lib/mediaLangs'
import { useAuth } from '@/contexts/AuthContext'
import { libraryService } from '@/services/libraryService'
import ConfirmModal from '@/components/ui/ConfirmModal'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Open the import flow (lives as its own modal on the profile page). */
  onOpenImport: () => void
}

// Visibility options, widest-audience last, each with an icon for the segmented
// control. Order matches the platform's mental model: private → friends → public.
const VIS_OPTIONS: { key: Visibility; labelKey: string; hintKey: string; icon: IconType }[] = [
  { key: 'nobody', labelKey: 'visibilityNobody', hintKey: 'visibilityNobodyHint', icon: IoLockClosedOutline },
  { key: 'friends', labelKey: 'visibilityFriends', hintKey: 'visibilityFriendsHint', icon: IoPeopleOutline },
  { key: 'everyone', labelKey: 'visibilityEveryone', hintKey: 'visibilityEveryoneHint', icon: IoEarthOutline },
]

// Per-facet copy + icon for the privacy rows.
const FACET_META: Record<PrivacyFacet, { labelKey: string; icon: IconType }> = {
  shelf: { labelKey: 'privacyShelf', icon: IoLibraryOutline },
  ratings: { labelKey: 'privacyRatings', icon: IoStarOutline },
  activity: { labelKey: 'privacyActivity', icon: IoPulseOutline },
}

// Copy for the feed's top-row block toggles.
const FEED_BLOCK_META: Record<FeedBlock, string> = {
  progress: 'settingsFeedBlockProgress',
  challenge: 'settingsFeedBlockChallenge',
  stats: 'settingsFeedBlockStats',
  trending: 'settingsFeedBlockTrending',
}

export default function SettingsModal({ isOpen, onClose, onOpenImport }: Props) {
  const { t, language, setLanguage } = useLanguage()
  const {
    showInProgress, setShowInProgress, privacy, setVisibility,
    preferredMediaLang, setPreferredMediaLang, feedBlocks, setFeedBlockVisible,
  } = usePreferences()
  const { logout, user } = useAuth()
  // Two-step delete: 0 = idle, 1 = first confirm, 2 = final confirm.
  const [wipeStep, setWipeStep] = useState(0)
  const [wiping, setWiping] = useState(false)

  const wipeLibrary = async () => {
    setWiping(true)
    try {
      await libraryService.wipeLibrary()
      // Hard reload so every cached view reflects the now-empty library.
      window.location.href = '/library'
    } catch {
      setWiping(false)
      setWipeStep(0)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--container)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">{t('settingsTitle')}</h2>
          <button onClick={onClose} aria-label={t('back')} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-7 overflow-y-auto px-6 py-5">
          {/* ── Nons account ────────────────────────────────────────────── */}
          <section>
            <SectionHeader title={t('settingsNons')} hint={t('settingsNonsHint')} />
            <a
              href={`https://nonsapp.com/u/${user?.username}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--text)] transition-colors hover:border-[var(--border)]"
            >
              <NonsLogo className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-muted)]" />
              <span className="flex-1 font-medium">{t('settingsNonsLink')}</span>
              <IoOpenOutline className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
            </a>
          </section>

          {/* ── Privacy ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeader title={t('settingsPrivacy')} hint={t('settingsPrivacyHint')} />
            <div className="flex flex-col gap-4">
              {PRIVACY_FACETS.map((facet) => {
                const meta = FACET_META[facet]
                const Icon = meta.icon
                return (
                  <div key={facet}>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <Icon className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-muted)]" />
                      <p className="text-sm font-medium text-[var(--text)]">{t(meta.labelKey)}</p>
                    </div>
                    <VisibilitySelect value={privacy[facet]} onChange={(v) => setVisibility(facet, v)} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Preferences ─────────────────────────────────────────────── */}
          <section>
            <SectionHeader title={t('settingsPreferences')} />
            <div className="flex flex-col gap-3">
              {/* Language */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-[var(--text)]">{t('language')}</span>
                <LanguageSelect value={language} onChange={setLanguage} />
              </div>

              {/* Preferred display language for movies/series */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-[var(--text)]">Preferred film/series language</span>
                <p className="text-xs text-[var(--text-muted)]">When available, titles and synopses show in this language.</p>
                <select
                  value={preferredMediaLang}
                  onChange={(e) => setPreferredMediaLang(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--border-subtle)] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-nonsprimary focus:border-transparent"
                >
                  <option value="">Catalog default</option>
                  {MEDIA_LANG_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Show in-progress on Library */}
              <button
                onClick={() => setShowInProgress(!showInProgress)}
                className="flex items-center justify-between gap-3 text-left"
              >
                <span className="text-sm text-[var(--text)]">{t('settingsShowInProgress')}</span>
                <span className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${showInProgress ? 'bg-nonsprimary' : 'bg-[var(--border-strong)]'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${showInProgress ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>
          </section>

          {/* ── Feed layout ─────────────────────────────────────────────── */}
          <section>
            <SectionHeader title={t('settingsFeedLayout')} hint={t('settingsFeedLayoutHint')} />
            <div className="flex flex-col gap-3">
              {FEED_BLOCKS.map((block) => {
                const visible = feedBlocks[block]
                return (
                  <button
                    key={block}
                    onClick={() => setFeedBlockVisible(block, !visible)}
                    className="flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-sm text-[var(--text)]">{t(FEED_BLOCK_META[block])}</span>
                    <span className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${visible ? 'bg-nonsprimary' : 'bg-[var(--border-strong)]'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${visible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Account ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeader title={t('settingsAccount')} />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { onOpenImport(); onClose() }}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--text)] transition-colors hover:border-[var(--border)]"
              >
                <IoCloudUploadOutline className="h-[18px] w-[18px] text-[var(--text-muted)]" />
                <span>
                  <span className="block font-medium">{t('settingsImport')}</span>
                  <span className="text-xs text-[var(--text-muted)]">{t('settingsImportHint')}</span>
                </span>
              </button>

              <button
                onClick={() => logout()}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
              >
                <IoLogOutOutline className="h-[18px] w-[18px]" />
                {t('logout')}
              </button>

              <button
                onClick={() => setWipeStep(1)}
                className="flex items-center gap-3 rounded-xl border border-red-500/30 px-4 py-3 text-left text-sm transition-colors hover:bg-red-500/10"
              >
                <IoTrashOutline className="h-[18px] w-[18px] text-red-500" />
                <span>
                  <span className="block font-medium text-red-500">{t('deleteLibrary')}</span>
                  <span className="text-xs text-[var(--text-muted)]">{t('deleteLibraryHint')}</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Two-step confirmation — deleting a whole library is irreversible. */}
      {wipeStep === 1 && (
        <ConfirmModal
          title={t('deleteLibrary')}
          message={t('deleteLibraryConfirm1')}
          confirmText={t('continue')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={() => setWipeStep(2)}
          onCancel={() => setWipeStep(0)}
        />
      )}
      {wipeStep === 2 && (
        <ConfirmModal
          title={t('deleteLibraryFinalTitle')}
          message={t('deleteLibraryConfirm2')}
          confirmText={wiping ? t('deleting') : t('deleteLibraryConfirmAction')}
          cancelText={t('cancel')}
          variant="danger"
          busy={wiping}
          onConfirm={wipeLibrary}
          onCancel={() => setWipeStep(0)}
        />
      )}
    </div>
  )
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</h3>
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}

// Segmented Only me / Friends / Everyone control.
function VisibilitySelect({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const { t } = useLanguage()
  return (
    <div className="flex gap-1 rounded-xl bg-[var(--surface)] p-1">
      {VIS_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            title={t(opt.hintKey)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--container)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-nonsprimary' : ''}`} />
            {t(opt.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
