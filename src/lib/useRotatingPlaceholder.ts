import { useEffect, useState } from 'react'

const TYPE_MS = 70 // per letter typed
const ERASE_MS = 35 // per letter erased
const HOLD_MS = 1600 // a finished word stays this long
const GAP_MS = 300 // pause on the bare prefix before the next word
const SWAP_MS = 2000 // reduced motion: whole words swap at this pace

// A search placeholder whose last word cycles: "Search for books" → erased →
// "Search for movies" → … → "Search for users" → back to books. Each word is
// typed out and erased letter by letter; with prefers-reduced-motion the words
// just swap. `words` is a "|"-separated list (a plain string, so a translation
// can carry it). Only animates while `active` (pass "the field is empty" — the
// placeholder is invisible otherwise). Use the full sentence as aria-label.
export function useRotatingPlaceholder(prefix: string, words: string, active = true): string {
  const key = `${prefix}\u0000${words}`
  const [state, setState] = useState({ key, text: prefix })
  // New prefix/words (language switch): start over. (Adjusting state while
  // rendering is React's recommended way to reset on a prop change.)
  if (state.key !== key) setState({ key, text: prefix })

  useEffect(() => {
    const list = words.split('|').map((w) => w.trim()).filter(Boolean)
    if (!active || list.length === 0) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let word = 0
    let letters = 0
    let erasing = false
    let timer: ReturnType<typeof setTimeout>
    const show = (text: string) => setState({ key, text })

    const tick = () => {
      const w = list[word]
      if (reduce) {
        show(prefix + w)
        word = (word + 1) % list.length
        timer = setTimeout(tick, SWAP_MS)
        return
      }
      if (!erasing) {
        letters += 1
        show(prefix + w.slice(0, letters))
        if (letters >= w.length) {
          erasing = true
          timer = setTimeout(tick, HOLD_MS)
        } else {
          timer = setTimeout(tick, TYPE_MS)
        }
      } else {
        letters -= 1
        show(prefix + w.slice(0, letters))
        if (letters <= 0) {
          erasing = false
          word = (word + 1) % list.length
          timer = setTimeout(tick, GAP_MS)
        } else {
          timer = setTimeout(tick, ERASE_MS)
        }
      }
    }
    timer = setTimeout(tick, reduce ? 0 : TYPE_MS)
    return () => clearTimeout(timer)
  }, [key, prefix, words, active])

  return state.key === key ? state.text : prefix
}
