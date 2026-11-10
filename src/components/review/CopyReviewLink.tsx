'use client'

import { useEffect, useRef, useState } from 'react'
import { IoLinkOutline, IoCheckmark } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'

// Copies a shareable link to one review: the current media page plus
// ?review=<uuid>, which opens the page on that review and highlights it.
// Available to everyone — it only needs the review's public id, not a session.
export default function CopyReviewLink({ reviewUuid }: { reviewUuid: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = async () => {
    // Pathname only: drops other params (e.g. ?e=<edition>) so the link is clean.
    const url = `${window.location.origin}${window.location.pathname}?review=${reviewUuid}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      return // clipboard blocked (insecure context / permissions) — nothing to confirm
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={t('copyReviewLink')}
      aria-label={t('copyReviewLink')}
      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
        copied ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      {copied ? <IoCheckmark className="h-4 w-4" /> : <IoLinkOutline className="h-4 w-4" />}
      {copied ? t('copied') : t('copyReviewLink')}
    </button>
  )
}
