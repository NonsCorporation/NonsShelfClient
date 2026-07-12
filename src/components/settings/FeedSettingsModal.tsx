import { IoClose } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePreferences, FEED_BLOCKS, type FeedBlock } from '@/contexts/PreferencesContext'

type Props = {
  isOpen: boolean
  onClose: () => void
}

// Copy for the feed's top-row block toggles — kept in sync with the same
// keys used by the full SettingsModal's "Feed layout" section.
const FEED_BLOCK_META: Record<FeedBlock, string> = {
  progress: 'settingsFeedBlockProgress',
  challenge: 'settingsFeedBlockChallenge',
  stats: 'settingsFeedBlockStats',
  trending: 'settingsFeedBlockTrending',
}

// A small, single-purpose modal for the Feed page's gear icon — just the
// block toggles, not the full account/privacy settings (those stay behind
// the profile page's SettingsModal).
export default function FeedSettingsModal({ isOpen, onClose }: Props) {
  const { t } = useLanguage()
  const { feedBlocks, setFeedBlockVisible } = usePreferences()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--container)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">{t('settingsFeedLayout')}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('settingsFeedLayoutHint')}</p>
          </div>
          <button onClick={onClose} aria-label={t('back')} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
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
      </div>
    </div>
  )
}
