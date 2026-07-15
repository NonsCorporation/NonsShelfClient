import { useEffect, useState } from 'react'
import { addLike, removeLike, getLikeStatus } from '@/services/postLikeService'
import { IoChevronUp } from 'react-icons/io5'

// Feed-post "like", shown as a chevron (^) instead of a heart. Fetches its
// own status/count on mount — feed pages are small (10 posts), so this
// doesn't need comment-counts-style batching through the parent.
export default function LikeButton({ postId }: { postId: number }) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getLikeStatus(postId).then((s) => {
      if (!cancelled) {
        setLiked(s.liked)
        setCount(s.count)
      }
    })
    return () => {
      cancelled = true
    }
  }, [postId])

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      await (next ? addLike(postId) : removeLike(postId))
    } catch {
      setLiked(!next)
      setCount((c) => c + (next ? -1 : 1))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
        liked ? 'text-nonsprimary' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      <IoChevronUp className={`h-4 w-4 transition-transform ${liked ? '-translate-y-0.5' : ''}`} />
      {count > 0 && count}
    </button>
  )
}
