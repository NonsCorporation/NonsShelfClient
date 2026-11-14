// Shared bits of the profile editor: field limits, the visibility type, how a form
// turns into an update, and client-side photo preparation. The data itself lives
// on the server (nons-library-server /api/me, /api/me/profile, /api/me/avatar).

export const BIO_MAX = 280
export const NAME_MAX = 50

/** Who may see a profile field. "friends" = accepted friends only. */
export type Visibility = 'public' | 'friends' | 'private'

/** The editable account fields as the server reports them on /api/me. */
export type ProfileAccount = {
  username: string
  name?: string
  first_name?: string
  last_name?: string
  bio?: string
  /** Banner colour as the server stores it: "F12312", or empty for automatic. */
  banner_color?: string
  location_country?: string
  location_city?: string
  bio_visibility?: Visibility
  location_visibility?: Visibility
}

/** The editor's form state. */
export type ProfileForm = {
  firstName: string
  lastName: string
  username: string
  bio: string
  /** Banner colour ("F12312"); empty = automatic. */
  bannerColor: string
  country: string
  city: string
  bioVisibility: Visibility
  locationVisibility: Visibility
}

/** A partial update for PUT /api/me/profile — only the keys present are changed. */
export type ProfilePatch = Partial<{
  first_name: string
  last_name: string
  username: string
  bio: string
  banner_color: string
  location_country: string
  location_city: string
  bio_visibility: Visibility
  location_visibility: Visibility
  finished_introduction: boolean
}>

/** Splits "Mary Jane Watson" into first "Mary" / last "Jane Watson" — only used
 *  when the server predates first_name/last_name and sends just a full name. */
export function splitName(full: string): { first: string; last: string } {
  const [first = '', ...rest] = full.trim().split(/\s+/)
  return { first, last: rest.join(' ') }
}

/** The form's starting values from the signed-in user's account. */
export function formFromAccount(a: ProfileAccount): ProfileForm {
  const fallback = splitName(a.name ?? '')
  return {
    firstName: a.first_name ?? fallback.first,
    lastName: a.last_name ?? fallback.last,
    username: a.username,
    bio: a.bio ?? '',
    bannerColor: a.banner_color ?? '',
    country: a.location_country ?? '',
    city: a.location_city ?? '',
    bioVisibility: a.bio_visibility ?? 'public',
    locationVisibility: a.location_visibility ?? 'public',
  }
}

/** What actually changed between the account and the form, as an update. Saving
 *  the editor always marks the welcome step as done. */
export function buildProfilePatch(form: ProfileForm, account: ProfileAccount): ProfilePatch {
  const before = formFromAccount(account)
  const patch: ProfilePatch = { finished_introduction: true }
  const first = form.firstName.trim()
  const last = form.lastName.trim()
  const bio = form.bio.trim()
  const city = form.city.trim()
  if (first !== before.firstName) patch.first_name = first
  if (last !== before.lastName) patch.last_name = last
  if (form.username !== before.username) patch.username = form.username
  if (bio !== before.bio) patch.bio = bio
  if (form.bannerColor !== before.bannerColor) patch.banner_color = form.bannerColor
  if (form.country !== before.country) patch.location_country = form.country
  if (city !== before.city) patch.location_city = city
  if (form.bioVisibility !== before.bioVisibility) patch.bio_visibility = form.bioVisibility
  if (form.locationVisibility !== before.locationVisibility) patch.location_visibility = form.locationVisibility
  return patch
}
