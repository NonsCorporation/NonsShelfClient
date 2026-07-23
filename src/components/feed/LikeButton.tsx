import { useEffect, useState } from 'react'
import {
  addLike, removeLike, getLikeStatus,
  addReviewLike, removeReviewLike, getReviewLikeStatus,
} from '@/services/postLikeService'
import { IoChevronUp } from 'react-icons/io5'

// "Like", shown as a chevron (^) instead of a heart. Works for either a feed
// post (postId) or a media-page review (reviewId) — the review case shares its
// tally with the feed post that echoes it, so the count matches on both surfaces.
// Fetches its own status/count on mount (feed pages are small).
type Props = { postId: number; reviewId?: undefined } | { reviewId: number; postId?: undefined }

export default function LikeButton(props: Props) {
  const isReview = props.reviewId != null
  const id = isReview ? props.reviewId! : props.postId!
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const status = isReview ? getReviewLikeStatus(id) : getLikeStatus(id)
    status.then((s) => {
      if (!cancelled) {
        setLiked(s.liked)
        setCount(s.count)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, isReview])

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      if (isReview) await (next ? addReviewLike(id) : removeReviewLike(id))
      else await (next ? addLike(id) : removeLike(id))
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
