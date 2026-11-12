'use client'

import { useState } from 'react'
import { hashHue } from '@/lib/hashHue'

// OpenLibrary (and some other hosts) answer 200 OK with a 1x1 placeholder gif for
// items that have no real cover instead of a 404, so a tiny decoded image counts
// as "no cover" too.
const MIN_COVER_DIM = 4

/**
 * The cover drawn for an item that has none: a dark field tinted by a hue taken
 * from its title and author, the author at the top and the title in the middle.
 * It is the same placeholder the statistics shelf uses. Text sizes follow the
 * cover's own width (container query units), so it reads from a 32px search
 * thumbnail to a full detail-page cover, and drops the text when it would be too
 * small to read.
 */
export function GeneratedCover({ title, author, className = 'h-full w-full' }: { title?: string; author?: string; className?: string }) {
  const hue = hashHue(`${title || ''}${author || ''}`)
  return (
    <span className={`@container block overflow-hidden ${className}`} style={{ backgroundColor: `hsl(${hue}, 22%, 15%)` }}>
      <span className="flex h-full w-full flex-col justify-between @max-[36px]:hidden" style={{ padding: '9cqw' }}>
        <span className="line-clamp-1 text-white/75" style={{ fontSize: 'clamp(5px, 9cqw, 15px)' }}>
          {author}
        </span>
        <span className="line-clamp-5 text-center font-extrabold leading-tight text-white" style={{ fontSize: 'clamp(6px, 13cqw, 26px)' }}>
          {title}
        </span>
        <span />
      </span>
    </span>
  )
}

/**
 * A cover image that never shows an empty box: with no url, an image that fails
 * to load, or a 1x1 placeholder, it falls back to the generated cover. Give it the
 * same classes the plain <img> had (size, rounding, object-cover…).
 */
export default function BookCover({
  url,
  title,
  author,
  alt = '',
  className = 'h-full w-full object-cover',
  loading = 'lazy',
}: {
  url?: string | null
  title?: string
  author?: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  // Remember which url failed (not just "failed") so a new url gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null)
  if (!url || failed === url) return <GeneratedCover title={title} author={author} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailed(url)}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth < MIN_COVER_DIM || img.naturalHeight < MIN_COVER_DIM) setFailed(url)
      }}
    />
  )
}
