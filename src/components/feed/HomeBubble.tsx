'use client'

import { useEffect, useState } from 'react'
import { IoBulb, IoClose } from 'react-icons/io5'
import GreetingBubble from '@/components/feed/GreetingBubble'
import { useLanguage } from '@/contexts/LanguageContext'
import { bubbleIcon } from '@/lib/bubbleIcons'
import { bubbleAt, dismissBubble, dismissedIds } from '@/lib/bubbleRotation'
import { getActiveBubbles, type ActiveBubbles, type Bubble } from '@/services/bubbleService'

/** How often the shown bubble is re-picked: enough to switch on the hour and honour start delays. */
const TICK_MS = 15000

// The message pill next to the feed's greeting. What it says comes from the bubbles
// an admin set up (Admin panel → Bubbles): the eligible ones take turns, one at a
// time, each for its own stretch (an hour by default). Until an admin has set any
// up — or if the server can't be reached — the built-in "tell us your wishes" pill
// shows, as it always has.
export default function HomeBubble({ full = false }: { full?: boolean }) {
  const { t } = useLanguage()
  const [data, setData] = useState<ActiveBubbles | null | undefined>(undefined)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  // All time-dependent values live in state, updated from effects (never read while
  // rendering): the server's clock (so everyone rotates in step) and how long this
  // page has been open (for "show after N seconds").
  const [clock, setClock] = useState({ serverMs: 0, openMs: 0 })

  useEffect(() => {
    let cancelled = false
    let skewMs = 0 // server time minus this device's
    const openedAt = Date.now()
    const update = () => setClock({ serverMs: Date.now() + skewMs, openMs: Date.now() - openedAt })

    getActiveBubbles().then((d) => {
      if (cancelled) return
      if (d) skewMs = d.now * 1000 - Date.now()
      setDismissed(dismissedIds(Date.now()))
      update()
      setData(d)
    })
    const timer = setInterval(update, TICK_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (data === undefined) return null // still asking; don't flash the built-in one

  if (data === null || !data.any) {
    return (
      <GreetingBubble className={full ? 'w-full' : ''} text={t('feedBubbleSuggest')} href="/suggestions" icon={IoBulb} color="#8b7bd8" />
    )
  }

  const open = data.bubbles.filter((b) => !dismissed.has(b.id))
  const current = bubbleAt(open, Math.floor(clock.serverMs / 1000))
  if (!current) return null
  // "Show after N seconds": hold it back until the page has been open that long.
  if (clock.openMs < current.delay_seconds * 1000) return null

  const close = (b: Bubble) => {
    dismissBubble(b, Date.now())
    setDismissed((prev) => new Set(prev).add(b.id))
  }

  return (
    <div className={`flex items-center gap-1.5 ${full ? 'w-full' : 'max-w-full'}`}>
      <GreetingBubble
        key={current.id}
        className={full ? 'min-w-0 flex-1' : 'min-w-0'}
        text={current.text}
        href={current.href}
        icon={bubbleIcon(current.icon)}
        color={current.color}
        background={current.background || undefined}
      />
      {current.dismissible && (
        <button
          type="button"
          onClick={() => close(current)}
          aria-label={t('close')}
          title={t('close')}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
        >
          <IoClose className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
