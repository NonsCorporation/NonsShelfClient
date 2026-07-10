'use client'

import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import DOMPurify from 'dompurify'

export interface ReviewContentProps {
  /** Review body — HTML (bold/italic/spoiler) or legacy plain text. */
  content: string
  /** Classes applied to the rendered element. */
  className?: string
  style?: CSSProperties
  /** Optional click handler (e.g. click-to-edit your own review). Runs after
   *  the built-in spoiler reveal. */
  onClick?: (event: MouseEvent<HTMLDivElement>) => void
}

// Reviews written before the rich editor (and most reviews in practice) are
// plain text. Only treat a value as HTML when it actually contains a tag, so
// plain text keeps its literal characters and line breaks instead of being
// reinterpreted (and stripped) as markup.
const looksLikeHtml = (value: string) => /<[a-z][\s\S]*>/i.test(value)

// Reveal a spoiler when tapped. Delegated from the container so a single
// handler covers every spoiler span in the review.
function handleSpoilerClick(event: MouseEvent<HTMLDivElement>) {
  const spoiler = (event.target as HTMLElement).closest('.spoiler-text')
  if (spoiler) spoiler.classList.toggle('revealed')
}

// The read-only counterpart of ReviewEditor: renders a review's bold/italic/
// spoiler HTML (sanitised) with tap-to-reveal spoilers. Shared by every place a
// review is displayed. `className` controls typography (size/colour/leading) so
// each call site keeps its existing look.
export default function ReviewContent({ content, className = '', style, onClick }: ReviewContentProps) {
  const isHtml = useMemo(() => looksLikeHtml(content), [content])

  const clean = useMemo(() => {
    if (!isHtml) return ''
    // DOMPurify needs a DOM; during SSR fall back to the raw string (our own
    // controlled markup) and let the client re-sanitise on hydration.
    if (typeof window === 'undefined') return content
    return DOMPurify.sanitize(content, { ADD_ATTR: ['data-spoiler'] })
  }, [content, isHtml])

  if (!content) return null

  if (!isHtml) {
    return (
      <div className={`review-content whitespace-pre-wrap ${className}`} style={style} onClick={onClick}>
        {content}
      </div>
    )
  }

  return (
    <div
      className={`review-content ${className}`}
      style={style}
      onClick={(event) => {
        handleSpoilerClick(event)
        onClick?.(event)
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
