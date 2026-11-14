'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A small transient message at the bottom of the screen.
//   const toast = useToast()
//   toast.show('Soon')
//   return <>…{toast.node}</>   // render `node` once in the component
export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current)
      setMessage(text)
      timer.current = setTimeout(() => setMessage(null), durationMs)
    },
    [durationMs],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const node =
    message !== null && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="status"
            className="fixed bottom-28 left-1/2 z-[80] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--container)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg lg:bottom-6"
          >
            {message}
          </div>,
          document.body,
        )
      : null

  return { show, node }
}
