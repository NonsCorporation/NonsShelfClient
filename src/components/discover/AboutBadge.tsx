import { IoLayersOutline, IoPeopleOutline, IoBookmarksOutline, IoCloudUploadOutline } from 'react-icons/io5'
import ShelfLogo from '@/components/branding/ShelfLogo'
import type { useLanguage } from '@/contexts/LanguageContext'

type Translate = ReturnType<typeof useLanguage>['t']

const FEATURES = [
  { Icon: IoLayersOutline, key: 'aboutBadgeFeat1' as const },
  { Icon: IoPeopleOutline, key: 'aboutBadgeFeat2' as const },
  { Icon: IoBookmarksOutline, key: 'aboutBadgeFeat3' as const },
  { Icon: IoCloudUploadOutline, key: 'aboutBadgeFeat4' as const },
]

// A compact, near-black strip introducing SomeShelf to a signed-out visitor —
// the condensed replacement for the old full-page marketing landing (deleted in
// favor of showing Discover itself at '/'). Sits above FindSomething so it's
// the first thing seen, without pushing the real catalog content down a whole
// screen's worth like the old hero did.
export default function AboutBadge({ t }: { t: Translate }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-black">
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ShelfLogo className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{t('aboutBadgeTitle')}</p>
            <p className="text-xs text-white/50">{t('aboutBadgeSubtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map(({ Icon, key }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/80"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {t(key)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
