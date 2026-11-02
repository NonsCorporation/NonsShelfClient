import { useCallback, useEffect, useState } from 'react'
import type { MediaType } from '../types'

// Profile customization: the editable profile details (display name, username,
// bio, location, photo) plus a banner and a pinned showcase of titles. There is
// no backend for this yet, so it is a MOCK that lives in localStorage — per
// user, on this browser, and visible only on your own profile. The name and
// username are display overrides only: they never change the real account.
// Everything goes through load/save here, so moving it server-side later only
// touches this file.

export const MAX_PINS = 6

export type PinnedItem = {
  id: string
  uuid?: string
  type: MediaType
  title: string
  coverUrl?: string
  year?: number
  creator?: string
}

export type Visibility = 'public' | 'private'

export const BIO_MAX = 280

export type ProfileCustomization = {
  /** Display name shown instead of the account name. */
  name?: string
  /** Display @handle shown instead of the account username (cosmetic only). */
  username?: string
  bio?: string
  country?: string
  city?: string
  bioVisibility?: Visibility
  locationVisibility?: Visibility
  /** Custom profile photo (data URL); overrides the account avatar on the profile. */
  avatar?: string
  /** Banner image (data URL). */
  banner?: string
  pins: PinnedItem[]
}

const EMPTY: ProfileCustomization = { pins: [] }
const keyFor = (userId: number) => `nons_profile_custom_${userId}`

function load(userId: number): ProfileCustomization {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
    const vis = (v: unknown): Visibility | undefined => (v === 'public' || v === 'private' ? v : undefined)
    return {
      name: str(raw.name),
      username: str(raw.username),
      bio: str(raw.bio),
      country: str(raw.country),
      city: str(raw.city),
      bioVisibility: vis(raw.bioVisibility),
      locationVisibility: vis(raw.locationVisibility),
      avatar: typeof raw.avatar === 'string' ? raw.avatar : undefined,
      banner: typeof raw.banner === 'string' ? raw.banner : undefined,
      pins: Array.isArray(raw.pins) ? raw.pins.slice(0, MAX_PINS) : [],
    }
  } catch {
    return EMPTY
  }
}

// Returns false when the browser refused the write (storage full/disabled).
function save(userId: number, value: ProfileCustomization): boolean {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** The signed-in viewer's customization plus a patch-style updater. `update`
 *  resolves false (leaving state untouched) if the change couldn't be stored. */
export function useProfileCustomization(userId: number | undefined) {
  const [custom, setCustom] = useState<ProfileCustomization>(EMPTY)

  useEffect(() => {
    // Loaded after mount (not in the initial state) so SSR and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustom(userId ? load(userId) : EMPTY)
  }, [userId])

  const update = useCallback(
    (patch: Partial<ProfileCustomization>): boolean => {
      if (!userId) return false
      const next = { ...load(userId), ...patch }
      if (!save(userId, next)) return false
      setCustom(next)
      return true
    },
    [userId],
  )

  return { custom, update }
}

/** Centre-crops an image file to `width`×`height` and returns it as a JPEG data
 *  URL — small enough to keep in localStorage. Rejects for non-images. */
export function imageToDataUrl(file: File, width: number, height: number, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unavailable'))
        return
      }
      // "cover" fit: scale to fill, crop the overflow evenly on both sides.
      const scale = Math.max(width / img.width, height / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('could not read image'))
    }
    img.src = url
  })
}

export { load as loadProfileCustomization }
