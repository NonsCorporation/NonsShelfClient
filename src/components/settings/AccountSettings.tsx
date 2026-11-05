'use client'

import { useState } from 'react'
import {
  IoCloudUploadOutline, IoLogOutOutline, IoMoonOutline, IoPhonePortraitOutline,
  IoSunnyOutline, IoTrashOutline,
} from 'react-icons/io5'
import { useLogoutConfirm } from '@/components/auth/useLogoutConfirm'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ImportModal from '@/components/import-export/ImportModal'
import LanguageSelect from '@/components/ui/LanguageSelect'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreferences, FEED_BLOCKS, type FeedBlock, type Theme } from '@/contexts/PreferencesContext'
import { MEDIA_LANG_OPTIONS } from '@/lib/mediaLangs'
import { libraryService } from '@/services/libraryService'
import { SegmentedSelect, Switch, type Option } from './ui'

const THEME_OPTIONS: Option<Theme>[] = [
  { key: 'system', labelKey: 'themeSystem', hintKey: 'themeSystem', icon: IoPhonePortraitOutline },
  { key: 'light', labelKey: 'themeLight', hintKey: 'themeLight', icon: IoSunnyOutline },
  { key: 'dark', labelKey: 'themeDark', hintKey: 'themeDark', icon: IoMoonOutline },
]

const FEED_BLOCK_META: Record<FeedBlock, string> = {
  progress: 'settingsFeedBlockProgress',
  challenge: 'settingsFeedBlockChallenge',
  stats: 'settingsFeedBlockStats',
  trending: 'settingsFeedBlockTrending',
  discover: 'settingsFeedBlockDiscover',
}

// The app-wide preferences that used to live in the profile's settings modal:
// theme, languages, the in-progress shelf, feed blocks, plus import / log out /
// delete library. Everything applies immediately.
export default function AccountSettings() {
  const { t, language, setLanguage } = useLanguage()
  const {
    showInProgress, setShowInProgress, preferredMediaLang, setPreferredMediaLang,
    feedBlocks, setFeedBlockVisible, theme, setTheme,
  } = usePreferences()
  const { ask: askLogout, modal: logoutModal } = useLogoutConfirm()
  const [importOpen, setImportOpen] = useState(false)
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

  const card = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:p-5'
  const line = 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6'
  const label = 'text-sm font-medium text-[var(--text)]'

  return (
    <div className="flex flex-col gap-3">
      <section className={`${card} flex flex-col gap-4`}>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{t('settingsPreferences')}</h3>
        <div className={line}>
          <span className={label}>{t('settingsTheme')}</span>
          <div className="sm:w-[26rem]"><SegmentedSelect options={THEME_OPTIONS} value={theme} onChange={setTheme} /></div>
        </div>
        <div className={line}>
          <span className={label}>{t('language')}</span>
          <div className="sm:w-[26rem]"><LanguageSelect value={language} onChange={setLanguage} /></div>
        </div>
        <div className={line}>
          <span>
            <span className={`${label} block`}>Preferred film/series language</span>
            <span className="text-xs text-[var(--text-muted)]">When available, titles and synopses show in this language.</span>
          </span>
          <select
            value={preferredMediaLang}
            onChange={(e) => setPreferredMediaLang(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nonsprimary sm:w-[26rem]"
          >
            <option value="">Catalog default</option>
            {MEDIA_LANG_OPTIONS.map((opt) => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
          </select>
        </div>
        <div className={`${line} !flex-row items-center`}>
          <span className={label}>{t('settingsShowInProgress')}</span>
          <Switch checked={showInProgress} onChange={setShowInProgress} label={t('settingsShowInProgress')} />
        </div>
      </section>

      <section className={card}>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{t('settingsFeedLayout')}</h3>
        <p className="mt-1 mb-4 text-xs text-[var(--text-muted)]">{t('settingsFeedLayoutHint')}</p>
        <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {FEED_BLOCKS.map((block) => (
            <div key={block} className="flex items-center justify-between gap-3">
              <span className={label}>{t(FEED_BLOCK_META[block])}</span>
              <Switch checked={feedBlocks[block]} onChange={(v) => setFeedBlockVisible(block, v)} label={t(FEED_BLOCK_META[block])} />
            </div>
          ))}
        </div>
      </section>

      <section className={`${card} flex flex-wrap items-center gap-3`}>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-left text-sm text-[var(--text)] transition-colors hover:border-[var(--border)]"
        >
          <IoCloudUploadOutline className="h-[18px] w-[18px] text-[var(--text-muted)]" />
          <span>
            <span className="block font-medium">{t('settingsImport')}</span>
            <span className="text-xs text-[var(--text-muted)]">{t('settingsImportHint')}</span>
          </span>
        </button>
        <button
          onClick={() => setWipeStep(1)}
          className="flex items-center gap-3 rounded-xl border border-red-500/30 px-4 py-2.5 text-left text-sm transition-colors hover:bg-red-500/10"
        >
          <IoTrashOutline className="h-[18px] w-[18px] text-red-500" />
          <span>
            <span className="block font-medium text-red-500">{t('deleteLibrary')}</span>
            <span className="text-xs text-[var(--text-muted)]">{t('deleteLibraryHint')}</span>
          </span>
        </button>
        <button
          onClick={askLogout}
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
        >
          <IoLogOutOutline className="h-[18px] w-[18px]" />
          {t('logout')}
        </button>
      </section>

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={() => setImportOpen(false)} />
      {wipeStep === 1 && (
        <ConfirmModal
          title={t('deleteLibrary')} message={t('deleteLibraryConfirm1')} confirmText={t('continue')}
          cancelText={t('cancel')} variant="danger" onConfirm={() => setWipeStep(2)} onCancel={() => setWipeStep(0)}
        />
      )}
      {wipeStep === 2 && (
        <ConfirmModal
          title={t('deleteLibraryFinalTitle')} message={t('deleteLibraryConfirm2')}
          confirmText={wiping ? t('deleting') : t('deleteLibraryConfirmAction')}
          cancelText={t('cancel')} variant="danger" busy={wiping} onConfirm={wipeLibrary} onCancel={() => setWipeStep(0)}
        />
      )}
      {logoutModal}
    </div>
  )
}
