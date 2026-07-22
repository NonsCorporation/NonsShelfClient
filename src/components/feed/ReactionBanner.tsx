import { IoChevronUp, IoRepeatOutline, IoChatbubbleOutline } from 'react-icons/io5'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { useLanguage } from '@/contexts/LanguageContext'
import type { UserReactionPayload } from '@/services/activityService'

const REACTION_KEY = { like: 'reactionLiked', repost: 'reactionReposted', comment: 'reactionCommented' } as const

// Sits inside a post's own card, above the post author's row — "<Name> liked
// this" etc. See userReactionPayload on Activity for why this is a stub.
export default function ReactionBanner({ payload }: { payload: UserReactionPayload }) {
  const { t } = useLanguage()

  return (
    <div className="mb-2 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
      <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 16, height: 16 }}>
        {payload.actorAvatarUrl ? (
          <img src={payload.actorAvatarUrl} alt={payload.actorName} loading="lazy" className="h-4 w-4 rounded-full object-cover" />
        ) : (
          <BoringAvatar size={16} name={payload.actorName} />
        )}
      </span>
      <span className="min-w-0 truncate">
        <span className="font-semibold text-[var(--text)]">{payload.actorName}</span> {t(REACTION_KEY[payload.type])}
      </span>
      {payload.type === 'like' ? (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)]">
          <IoChevronUp className="h-2.5 w-2.5" />
        </span>
      ) : payload.type === 'repost' ? (
        <IoRepeatOutline className="h-3 w-3 flex-shrink-0" />
      ) : (
        <IoChatbubbleOutline className="h-3 w-3 flex-shrink-0" />
      )}
    </div>
  )
}
