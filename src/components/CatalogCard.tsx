import { Link } from '@/lib/router'
import { IoStar, IoBookOutline, IoFilmOutline, IoTvOutline, IoAdd, IoCheckmark, IoPeopleOutline } from 'react-icons/io5'
import type { CatalogItem } from '../services/catalogService'
import { compactCount } from '../services/catalogService'
import { useLanguage } from '../contexts/LanguageContext'
import { mediaPath } from '../lib/paths'

type CatalogCardProps = {
  item: CatalogItem
  inLibrary: boolean
  onAdd: () => void
  showReason?: boolean
}

export default function CatalogCard({ item, inLibrary, onAdd, showReason }: CatalogCardProps) {
  const { t } = useLanguage()
  const isBook = item.type === 'book'
  const TypeIcon = isBook ? IoBookOutline : item.type === 'series' ? IoTvOutline : IoFilmOutline
  const credit = isBook ? item.author : item.director || item.author

  return (
    <div className="flex w-full flex-col">
      <Link to={mediaPath(item)} className="group block" title={item.title}>
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] transition-colors group-hover:border-[var(--border)]">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <TypeIcon className="h-8 w-8 text-[var(--placeholder)]" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />

          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
            <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
            {item.communityRating.toFixed(1)}
          </div>
          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/80">
            <TypeIcon className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="mt-2.5 min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--text)] group-hover:underline">
            {item.title}
          </h3>
          <p className="truncate text-xs text-[var(--text-muted)]">{credit}</p>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <IoPeopleOutline className="h-3.5 w-3.5" />
            <span>{t('ratingsCountLabel', { n: compactCount(item.ratingsCount) })}</span>
          </div>

          {showReason && item.recommendedBecause && (
            <p className="mt-1 line-clamp-2 text-[11px] italic text-[var(--text-muted)]/80">{item.recommendedBecause}</p>
          )}
        </div>
      </Link>

      <button
        onClick={onAdd}
        disabled={inLibrary}
        className={`mt-2.5 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
          inLibrary
            ? 'cursor-default border border-[var(--border-subtle)] text-[var(--text-muted)]'
            : 'border border-nonsprimary/40 text-nonsprimaryfocus hover:bg-[var(--primary-soft)]'
        }`}
      >
        {inLibrary ? (
          <>
            <IoCheckmark className="h-4 w-4" />
            {t('inLibrary')}
          </>
        ) : (
          <>
            <IoAdd className="h-4 w-4" />
            {t('addToLibrary')}
          </>
        )}
      </button>
    </div>
  )
}
