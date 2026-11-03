import { useEffect, useState } from 'react'

// Types a placeholder out a letter at a time ("Search for books, movies, …")
// instead of showing it all at once. Restarts when the text changes (e.g. a
// language switch). With prefers-reduced-motion it shows the text immediately.
// Use the full text for aria-label — screen readers shouldn't hear it typed.
export function useTypingPlaceholder(text: string, msPerChar = 35): string {
  const [shown, setShown] = useState({ text, n: 0 })
  // New text: start typing it from the beginning. (Adjusting state while
  // rendering is React's recommended way to reset on a prop change.)
  if (shown.text !== text) setShown({ text, n: 0 })

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let n = 0
    const id = setInterval(() => {
      n = reduce ? text.length : n + 1
      setShown({ text, n })
      if (n >= text.length) clearInterval(id)
    }, reduce ? 0 : msPerChar)
    return () => clearInterval(id)
  }, [text, msPerChar])

  return text.slice(0, shown.text === text ? shown.n : 0)
}
