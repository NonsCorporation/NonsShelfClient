import { Link } from '@/lib/router'
import BoringAvatar from '@/components/ui/BoringAvatar'
import type { CuratedListDiscoverEntry } from '@/types'

// A curated list as a fanned, floating stack of its covers over a tinted
// gradient — shared by Discover's lists rail / genre sublists and the feed.
// `big` runs the lead card taller with a larger stack.
export default function ListCard({ list, big }: { list: CuratedListDiscoverEntry; big?: boolean }) {
  const covers = (list.cover_urls ?? []).slice(0, big ? 4 : 3)
  return (
    <Link
      to={`/list/${list.uuid}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary-soft)] via-[var(--container-2)] to-[var(--container-2)] transition-transform hover:-translate-y-1 ${big ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}
    >
      {/* Floating, fanned covers — same visual language as a list's own page. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {covers.map((c, i, arr) => (
          <div
            key={i}
            style={{
              transform: `rotate(${(i - (arr.length - 1) / 2) * 9}deg) translateX(${(i - (arr.length - 1) / 2) * (big ? 26 : 18)}px)`,
              zIndex: i,
            }}
            className={`absolute overflow-hidden rounded-lg border-2 border-[var(--container)] shadow-xl transition-transform duration-300 group-hover:scale-105 ${big ? 'h-32 w-20 sm:h-40 sm:w-28' : 'h-20 w-14'}`}
          >
            {c && <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="relative mt-auto p-3">
        <p className={`truncate font-semibold text-white ${big ? 'text-xl' : 'text-sm'}`}>{list.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
          {list.owner_username && (
            <>
              {list.owner_avatar_url ? (
                <img src={list.owner_avatar_url} alt="" className="h-4 w-4 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-4 w-4 flex-shrink-0 overflow-hidden rounded-full">
                  <BoringAvatar size={16} name={`user-${list.user_id}`} />
                </span>
              )}
              <span className="truncate">{list.owner_name || list.owner_username}</span>
              <span>·</span>
            </>
          )}
          <span className="flex-shrink-0">{list.count} item{list.count !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </Link>
  )
}
