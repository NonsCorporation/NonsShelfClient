import type { Activity } from '@/services/activityService'
import type { Challenge } from '@/types'
import BoringAvatar from '@/components/ui/BoringAvatar'

// How many avatars a stack shows before collapsing the rest into "+N".
const AVATAR_STACK_CAP = 4

export type ChallengeViewer = { id: number; name: string; avatarUrl?: string }

/** Overlapping avatar circles for who's joined a challenge: you first (if
 *  you're a participant), then friends who joined, then whoever else is left
 *  in the preview — capped, with the true total (challenge.participants, not
 *  just the previewed subset) driving the "+N" overflow. Shared by the
 *  Discover challenge cards and the /challenge/<uuid> detail page so they
 *  can't drift apart. */
export default function ChallengeAvatarStack({
  challenge, viewer, friendMap, size = 24,
}: {
  challenge: Challenge
  viewer: ChallengeViewer | null
  friendMap: Map<number, Activity['user']>
  size?: number
}) {
  // Self-presence is checked against the preview itself, not just the
  // separate `joined` flag, so a stale/optimistic `joined` value can't blank
  // the stack out.
  const selfInPreview = challenge.participant_preview.some((p) => p.id === viewer?.id)
  const others = challenge.participant_preview.filter((p) => p.id !== viewer?.id)
  const friendsFirst = [...others.filter((p) => friendMap.has(p.id)), ...others.filter((p) => !friendMap.has(p.id))]
  const stack: ChallengeViewer[] = []
  if (viewer && (challenge.joined || selfInPreview)) stack.push(viewer)
  for (const p of friendsFirst) {
    if (stack.length >= AVATAR_STACK_CAP) break
    stack.push({ id: p.id, name: p.name, avatarUrl: p.avatar_url })
  }
  const overflow = Math.max(0, challenge.participants - stack.length)

  if (stack.length === 0) return null

  return (
    <div className="flex items-center -space-x-2">
      {stack.map((p) => (
        <span
          key={p.id}
          style={{ height: size, width: size }}
          className="flex-shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--container)]"
        >
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={p.name} title={p.name} className="h-full w-full object-cover" />
          ) : (
            <BoringAvatar size={size} name={String(p.id)} />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{ height: size, width: size }}
          className="flex flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[9px] font-semibold text-[var(--text-muted)] ring-2 ring-[var(--container)]"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
