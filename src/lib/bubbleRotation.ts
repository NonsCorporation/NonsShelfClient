import type { Bubble } from '../services/bubbleService'

// Which bubble holds the slot right now. The eligible bubbles take turns in order,
// each for its own duration (an hour by default), then the cycle starts over. It
// runs off one clock — the server's — so every viewer sees the same bubble at the
// same moment.

/** The bubble that owns the slot at `nowSeconds`, or null when there are none. */
export function bubbleAt(bubbles: Bubble[], nowSeconds: number): Bubble | null {
  if (bubbles.length === 0) return null
  const lengths = bubbles.map((b) => Math.max(1, b.duration_minutes) * 60)
  const cycle = lengths.reduce((a, b) => a + b, 0)
  let t = ((nowSeconds % cycle) + cycle) % cycle
  for (let i = 0; i < bubbles.length; i++) {
    if (t < lengths[i]) return bubbles[i]
    t -= lengths[i]
  }
  return bubbles[0]
}

// ── dismissals (this browser only) ──
// A dismissed bubble stays away for its `reshow_hours` (0 = for good).

const KEY = 'nons-library:bubbles:dismissed'
const FOREVER = 100 * 365 * 24 * 3600 * 1000

function read(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** The ids of bubbles currently dismissed. */
export function dismissedIds(nowMs: number): Set<number> {
  const out = new Set<number>()
  for (const [id, until] of Object.entries(read())) if (until > nowMs) out.add(Number(id))
  return out
}

export function dismissBubble(b: Bubble, nowMs: number) {
  try {
    const all = read()
    all[b.id] = nowMs + (b.reshow_hours > 0 ? b.reshow_hours * 3600 * 1000 : FOREVER)
    window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // storage blocked: it just comes back on the next visit
  }
}
