'use client'

import type { PetMood, PetStage } from '@/lib/pet'

type Props = {
  stage: PetStage
  mood: PetMood
  className?: string
  /** Briefly plays a chomp animation (set after feeding). */
  eating?: boolean
}

const BODY = '#6768ab'
const BODY_DARK = '#4e4f86'
const BELLY = '#a9aadc'

/** Hand-drawn SVG pet; the face follows the mood, the silhouette follows the stage. */
export default function PetSprite({ stage, mood, className, eating }: Props) {
  const sad = mood === 'hungry' || mood === 'starving'
  return (
    <>
      <style>{`
        @keyframes pet-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes pet-slump { 0%,100% { transform: translateY(0) scaleY(1) } 50% { transform: translateY(2px) scaleY(.98) } }
        @keyframes pet-wobble { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
        @keyframes pet-chomp { 0%,100% { transform: scaleY(1) } 30% { transform: scaleY(.55) } 60% { transform: scaleY(1.15) } }
        @keyframes pet-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
        .pet-body { transform-origin: 100px 190px; animation: pet-bob 2.4s ease-in-out infinite; }
        .pet-body[data-sad="true"] { animation: pet-slump 3.6s ease-in-out infinite; }
        .pet-egg { transform-origin: 100px 190px; animation: pet-wobble 2.8s ease-in-out infinite; }
        .pet-chomp { transform-box: fill-box; transform-origin: center; animation: pet-chomp .5s ease-in-out 2; }
        .pet-eye { transform-box: fill-box; transform-origin: center; animation: pet-blink 4.5s infinite; }
        @media (prefers-reduced-motion: reduce) { .pet-body, .pet-egg, .pet-chomp, .pet-eye { animation: none } }
      `}</style>
      <svg viewBox="0 0 200 200" className={className} role="img" aria-hidden="true">
        <ellipse cx="100" cy="190" rx="52" ry="6" fill="currentColor" opacity="0.12" />
        {stage === 'egg' ? <Egg mood={mood} /> : <Creature stage={stage} mood={mood} sad={sad} eating={!!eating} />}
      </svg>
    </>
  )
}

function Egg({ mood }: { mood: PetMood }) {
  return (
    <g className="pet-egg">
      <path d="M100 38c-34 0-56 50-56 92 0 33 24 56 56 56s56-23 56-56c0-42-22-92-56-92z" fill="#e9e6f5" stroke={BODY_DARK} strokeWidth="3" />
      <circle cx="78" cy="110" r="9" fill={BODY} opacity="0.55" />
      <circle cx="122" cy="132" r="12" fill={BODY} opacity="0.55" />
      <circle cx="96" cy="160" r="7" fill={BODY} opacity="0.55" />
      <path d="M72 78l12 10 8-12 10 12 10-10 12 12" fill="none" stroke={BODY_DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {(mood === 'hungry' || mood === 'starving') && (
        <path d="M150 54c4 0 8 4 8 8" fill="none" stroke={BODY_DARK} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      )}
    </g>
  )
}

function Creature({ stage, mood, sad, eating }: { stage: PetStage; mood: PetMood; sad: boolean; eating: boolean }) {
  const big = stage === 'bookworm' || stage === 'sage'
  const scale = stage === 'hatchling' ? 0.78 : 1
  return (
    <g className="pet-body" data-sad={sad} style={{ transformOrigin: '100px 190px' }}>
      <g transform={`translate(${100 - 100 * scale} ${190 - 190 * scale}) scale(${scale})`}>
        {/* feet */}
        <ellipse cx="74" cy="184" rx="14" ry="7" fill={BODY_DARK} />
        <ellipse cx="126" cy="184" rx="14" ry="7" fill={BODY_DARK} />

        {/* ears / leaf tuft */}
        <path d="M70 62c-8-18-2-30 8-32 4 12 2 24-8 32z" fill={BODY_DARK} />
        <path d="M130 62c8-18 2-30-8-32-4 12-2 24 8 32z" fill={BODY_DARK} />

        {/* body */}
        <path
          d="M100 48c-42 0-66 34-66 76 0 36 26 62 66 62s66-26 66-62c0-42-24-76-66-76z"
          fill={BODY}
        />
        <ellipse cx="100" cy="150" rx="34" ry="28" fill={BELLY} opacity="0.85" />

        {/* arms */}
        <ellipse cx="38" cy="132" rx="9" ry="16" fill={BODY_DARK} transform="rotate(14 38 132)" />
        <ellipse cx="162" cy="132" rx="9" ry="16" fill={BODY_DARK} transform="rotate(-14 162 132)" />

        {/* eyes */}
        <g>
          <ellipse className="pet-eye" cx="78" cy="104" rx="9" ry={mood === 'starving' ? 6 : 11} fill="#fff" />
          <ellipse className="pet-eye" cx="122" cy="104" rx="9" ry={mood === 'starving' ? 6 : 11} fill="#fff" />
          <circle cx="80" cy={sad ? 108 : 105} r="5" fill="#1a1a1a" />
          <circle cx="120" cy={sad ? 108 : 105} r="5" fill="#1a1a1a" />
          <circle cx="82" cy={sad ? 106 : 103} r="1.6" fill="#fff" />
          <circle cx="122" cy={sad ? 106 : 103} r="1.6" fill="#fff" />
        </g>

        {/* brows when sad */}
        {sad && (
          <g stroke={BODY_DARK} strokeWidth="3" strokeLinecap="round">
            <path d="M68 90l16 -5" />
            <path d="M132 90l-16 -5" />
          </g>
        )}

        {/* cheeks */}
        {mood === 'happy' && (
          <g fill="#ff7a85" opacity="0.55">
            <ellipse cx="62" cy="124" rx="8" ry="5" />
            <ellipse cx="138" cy="124" rx="8" ry="5" />
          </g>
        )}

        {/* mouth */}
        <g className={eating ? 'pet-chomp' : undefined}>
          {mood === 'happy' && <path d="M86 124q14 18 28 0z" fill="#3a2a4a" stroke="#3a2a4a" strokeWidth="2.5" strokeLinejoin="round" />}
          {mood === 'content' && <path d="M88 126q12 8 24 0" fill="none" stroke="#3a2a4a" strokeWidth="3" strokeLinecap="round" />}
          {mood === 'hungry' && <path d="M90 130q10 -7 20 0" fill="none" stroke="#3a2a4a" strokeWidth="3" strokeLinecap="round" />}
          {mood === 'starving' && <ellipse cx="100" cy="130" rx="7" ry="5" fill="#3a2a4a" />}
        </g>

        {/* sweat / stomach rumble */}
        {mood === 'starving' && <path d="M158 84q6 10 0 14q-6 -4 0 -14z" fill="#8ecbff" />}

        {/* bookworm+: reading glasses */}
        {big && (
          <g fill="none" stroke="#1a1a1a" strokeWidth="3">
            <circle cx="78" cy="104" r="15" />
            <circle cx="122" cy="104" r="15" />
            <path d="M93 104h14" />
          </g>
        )}

        {/* sage: little graduation cap */}
        {stage === 'sage' && (
          <g>
            <path d="M58 52l42-20 42 20-42 20z" fill="#1a1a1a" />
            <path d="M78 64v14c0 6 44 6 44 0V64" fill="#2a2a2a" />
            <path d="M142 52v22" stroke="#f5a623" strokeWidth="3" strokeLinecap="round" />
            <circle cx="142" cy="78" r="4" fill="#f5a623" />
          </g>
        )}
      </g>
    </g>
  )
}
