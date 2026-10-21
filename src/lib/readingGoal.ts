// Pace maths for the yearly reading goal.

export type GoalPace = {
  /** Books you should have finished by now to be on track (fractional). */
  expected: number
  /** progress − expected, rounded toward zero; positive = ahead. */
  delta: number
  status: 'ahead' | 'on' | 'behind'
}

/** Compare progress against a straight-line pace through the year. A half-book
 *  of slack either way counts as on pace, so one book doesn't flip the label. */
export function goalPace(progress: number, target: number, now: Date = new Date()): GoalPace {
  const year = now.getFullYear()
  const start = new Date(year, 0, 1).getTime()
  const end = new Date(year + 1, 0, 1).getTime()
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
  const expected = target * elapsed
  const diff = progress - expected
  const delta = Math.trunc(diff)
  const status = diff > 0.5 ? 'ahead' : diff < -0.5 ? 'behind' : 'on'
  return { expected, delta, status }
}
