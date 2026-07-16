import { nonsFetch } from '../lib/api'

export type FriendshipState = 'none' | 'pending' | 'accepted' | 'rejected'

export type FriendshipStatus = {
  status: FriendshipState
  /** Whether the current viewer is the one who sent the pending request
   *  (only meaningful when status === 'pending'). */
  isRequester: boolean
}

/** Friendship status between the signed-in viewer and `username`, from
 *  nons-server. Requests are mutual (request → accept/reject), independent
 *  of the one-directional follow relationship below. */
export async function getFriendshipStatus(username: string): Promise<FriendshipStatus> {
  try {
    const res = await nonsFetch(`/api/friendships/status/${encodeURIComponent(username)}`)
    if (!res.ok) return { status: 'none', isRequester: false }
    const data = await res.json()
    return { status: data.status ?? 'none', isRequester: !!data.is_requester }
  } catch {
    return { status: 'none', isRequester: false }
  }
}

export async function sendFriendRequest(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/friendships/request/${encodeURIComponent(username)}`, { method: 'POST' })
  return res.ok
}

export async function cancelFriendRequest(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/friendships/cancel/${encodeURIComponent(username)}`, { method: 'DELETE' })
  return res.ok
}

export async function acceptFriendRequest(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/friendships/accept/${encodeURIComponent(username)}`, { method: 'POST' })
  return res.ok
}

export async function rejectFriendRequest(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/friendships/reject/${encodeURIComponent(username)}`, { method: 'POST' })
  return res.ok
}

export async function removeFriend(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/friendships/remove/${encodeURIComponent(username)}`, { method: 'DELETE' })
  return res.ok
}

/** One-directional follow — independent of the friendship system above. */
export async function isFollowing(username: string): Promise<boolean> {
  try {
    const res = await nonsFetch(`/api/follow/check/${encodeURIComponent(username)}`)
    if (!res.ok) return false
    const data = await res.json()
    return !!data.is_following
  } catch {
    return false
  }
}

export async function follow(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/follow/${encodeURIComponent(username)}`, { method: 'POST' })
  return res.ok
}

export async function unfollow(username: string): Promise<boolean> {
  const res = await nonsFetch(`/api/follow/${encodeURIComponent(username)}`, { method: 'DELETE' })
  return res.ok
}
