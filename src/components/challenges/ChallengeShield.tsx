import { Link } from '@/lib/router'
import { IoRibbonOutline } from 'react-icons/io5'
import type { Challenge } from '@/types'
import { isGoalChallenge, challengeTitle } from '@/lib/challenge'

type Translate = (k: string, v?: Record<string, string | number>) => string

// Shield gradients carry the challenge kind at a glance: a rich purple for
// official challenges (the reading challenge), a brushed-silver/graphite for
// community-authored ones. Both keep white shield text readable. Plain hex via
// inline style rather than Tailwind palette classes, which run too bright here.
const OFFICIAL_GRADIENT = 'linear-gradient(135deg, #7c4dff, #2b1a66)'
const COMMUNITY_GRADIENT = 'linear-gradient(135deg, #9aa0ad, #3a3d44)'

// One challenge, as a shield: a gradient badge (purple for official, silver for
// community) with the title and "progress/target" inside. Solid border once the
// target's been hit, dashed while still in progress. A goal challenge with no
// number set yet (your own unjoined reading challenge) shows a "set goal"
// prompt instead of progress, so the shield doubles as a join affordance.
export default function ChallengeShield({ challenge, t }: { challenge: Challenge; t: Translate }) {
  const target = challenge.target ?? 0
  const progress = challenge.progress ?? 0
  const completed = (challenge.completed_at ?? 0) > 0
  const gradient = challenge.official ? OFFICIAL_GRADIENT : COMMUNITY_GRADIENT
  const title = challengeTitle(t, challenge)
  const goalPending = isGoalChallenge(challenge) && target === 0

  return (
    <Link
      to={`/challenge/${challenge.uuid}`}
      title={title}
      className="group flex w-24 flex-shrink-0 flex-col items-center"
    >
      <div
        style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)', background: gradient }}
        className={`flex h-28 w-24 flex-col items-center justify-center gap-1 p-3 text-center transition-transform group-hover:-translate-y-0.5 ${
          completed ? 'border-2 border-white/80' : 'border-2 border-dashed border-white/45'
        }`}
      >
        {challenge.official && <IoRibbonOutline className="h-3.5 w-3.5 text-white/90" />}
        <span className="line-clamp-3 text-[11px] font-bold leading-tight text-white drop-shadow-sm">
          {title}
        </span>
        {target > 0 ? (
          <span className="text-[10px] font-semibold text-white/85">{progress}/{target}</span>
        ) : goalPending ? (
          <span className="text-[10px] font-semibold text-white/85">{t('setGoal')}</span>
        ) : null}
      </div>
    </Link>
  )
}
