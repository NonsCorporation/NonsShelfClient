import 'server-only'
import type { Metadata } from 'next'
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicProfileCard, type PublicProfileCard } from './serverApi'

// SEO for public profile links (/u/<username>): the page <title>, description,
// OpenGraph/Twitter tags, JSON-LD, and the link-preview image — the in-app
// share card (ProfileShareModal) laid out horizontally: dark background with a
// brand glow, a large photo, name, @handle and short stats. Everything comes
// from the anonymous-safe profile card, so it never shows more than the owner's
// privacy settings allow.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://someshelf.com').replace(/\/+$/, '')

export const PROFILE_IMAGE_SIZE = { width: 1200, height: 630 }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "12 books, 30 films and 4 series" — only the non-zero ones. */
export function statsSentence(card: PublicProfileCard): string {
  const s = card.stats
  if (!s) return ''
  const parts = [
    s.books ? plural(s.books, 'book', 'books') : '',
    s.movies ? plural(s.movies, 'film', 'films') : '',
    s.series ? `${s.series} series` : '',
  ].filter(Boolean)
  if (parts.length === 0) return ''
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function describe(card: PublicProfileCard): string {
  const stats = statsSentence(card)
  const tail = stats ? `${stats} on SomeShelf.` : 'Books, films and series on SomeShelf.'
  return (card.bio ? `${card.bio} — ${tail}` : `${card.name} (@${card.username}) — ${tail}`).slice(0, 200)
}

export async function buildProfileMetadata(id: string): Promise<Metadata> {
  const card = await getPublicProfileCard(id)
  if (!card) return { title: 'Profile :: SomeShelf' }

  const title = `${card.name} (@${card.username}) :: SomeShelf`
  const description = describe(card)
  const url = `${SITE_URL}/u/${encodeURIComponent(card.username)}`
  // The preview image itself comes from the route's opengraph-image /
  // twitter-image files (Next wires those <meta> tags up automatically).
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', title, description, url, siteName: 'SomeShelf', username: card.username },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** schema.org ProfilePage, serialized safely for a <script> tag. */
export function profileJsonLd(card: PublicProfileCard): string {
  const url = `${SITE_URL}/u/${encodeURIComponent(card.username)}`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      name: card.name,
      alternateName: `@${card.username}`,
      identifier: card.username,
      url,
      ...(card.avatar_url ? { image: card.avatar_url } : {}),
      ...(card.bio ? { description: card.bio } : {}),
    },
  }
  // Escape "<" so user-written text (a bio containing "</script>") can't end
  // the script tag early.
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// ── the preview image ────────────────────────────────────────────────────────

const FONT_FILES: { file: string; weight: 400 | 700 }[] = [
  { file: 'onest-latin-400.woff', weight: 400 },
  { file: 'onest-latin-700.woff', weight: 700 },
  { file: 'onest-cyrillic-400.woff', weight: 400 },
  { file: 'onest-cyrillic-700.woff', weight: 700 },
]

// Onest (the site's font), Latin + Cyrillic: the image renderer's built-in font
// is Latin-only, so Russian names would otherwise come out as empty boxes.
export async function loadFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  return Promise.all(
    FONT_FILES.map(async ({ file, weight }) => ({
      name: 'Onest',
      data: await readFile(join(dir, file)),
      weight,
      style: 'normal' as const,
    })),
  )
}

/** The profile photo as a data URL, or null (missing, slow, or a format the
 *  image renderer can't draw — then the card shows initials instead). */
export async function avatarDataUrl(url?: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (type !== 'image/png' && type !== 'image/jpeg') return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > 2 * 1024 * 1024) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

// Same fixed dark palette as the in-app share card (ProfileShareModal), so a
// link preview and a shared story image look like the same product.
export const BG = '#000000'
export const INK = '#ffffff'
export const MUTED = '#9ca3af'
export const LINE = '#27272a'
export const PRIMARY = '#6768ab'
// The share card tints its glow with the photo's dominant colour (computed in
// the browser); here it uses the brand colour, which is that card's fallback.
export const GLOW = '103,104,171'

export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="86 89 340 340" fill={INK}>
      <g transform="translate(89.6, 89.6) scale(0.65)">
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(2.446384,0,0,2.4904064,-337.33813,-404.93892)" />
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(-2.446384,0,0,2.4904064,837.74641,-411.14917)" />
      </g>
      <rect x="211" y="112" width="90" height="200" rx="16" />
      <circle cx="256" cy="376" r="42" />
    </svg>
  )
}

// Small line icons in the brand colour, drawn as SVG (the image renderer can't
// use the app's icon components, and the font has no "★"). Each is ONE <path>:
// the renderer fails on React fragments ("Cannot convert a Symbol value").
type IconKind = 'book' | 'film' | 'tv' | 'star'
const ICON_PATHS: Record<Exclude<IconKind, 'star'>, string> = {
  book: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
  film: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v18 M17 3v18 M3 8h4 M3 12h18 M3 16h4 M17 8h4 M17 16h4',
  tv: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M17 2l-5 5-5-5',
}
const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'

function Icon({ kind, size }: { kind: IconKind; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'star' ? (
        <path d={STAR_PATH} fill={PRIMARY} />
      ) : (
        <path d={ICON_PATHS[kind]} fill="none" stroke={PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

// One stat, as on the share card: icon + bold number, small uppercase label.
// Every element with text has display:flex and ONE text child: the renderer
// rejects a div with several child nodes unless it is a flex container (that
// once made the whole image fail with a 500).
function Stat({ kind, value, label }: { kind: IconKind; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon kind={kind} size={36} />
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: INK, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 20, letterSpacing: 3, color: MUTED, marginTop: 12 }}>{label}</div>
    </div>
  )
}

/** Renders the link-preview card for /u/<id> — the in-app share card laid out
 *  horizontally (falls back to a plain brand card when the profile can't be
 *  loaded). */
export async function renderProfileImage(id: string): Promise<ImageResponse> {
  const [card, fonts] = await Promise.all([getPublicProfileCard(id), loadFonts()])
  const avatar = card ? await avatarDataUrl(card.avatar_url) : null

  const stats: { kind: IconKind; value: string; label: string }[] = []
  if (card?.stats) {
    const s = card.stats
    if (s.books) stats.push({ kind: 'book', value: String(s.books), label: s.books === 1 ? 'BOOK' : 'BOOKS' })
    if (s.movies) stats.push({ kind: 'film', value: String(s.movies), label: s.movies === 1 ? 'FILM' : 'FILMS' })
    if (s.series) stats.push({ kind: 'tv', value: String(s.series), label: 'SERIES' })
  }
  if (card?.rating) stats.push({ kind: 'star', value: card.rating.average.toFixed(1), label: 'AVG' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 64px',
          color: INK,
          fontFamily: 'Onest',
          background: `radial-gradient(circle at 22% 30%, rgba(${GLOW},0.38), transparent 58%), ${BG}`,
        }}
      >
        {/* logo, top — as on the share card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo size={34} />
          <div style={{ display: 'flex', fontSize: 20, letterSpacing: 5, color: INK }}>SOMESHELF.COM</div>
        </div>

        {card ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* identity + stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
              {/* The renderer ignores overflow:hidden for clipping, so the photo
                  is rounded itself, inside a ring drawn by the wrapper. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 312, height: 312, borderRadius: 9999, border: `4px solid ${LINE}`, flexShrink: 0 }}>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} width={296} height={296} style={{ borderRadius: 9999, objectFit: 'cover' }} alt="" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 296, height: 296, borderRadius: 9999, background: LINE, color: INK, fontSize: 110, fontWeight: 700 }}>
                    {initials(card.name)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>{clip(card.name, 16)}</div>
                <div style={{ display: 'flex', fontSize: 38, color: MUTED, marginTop: 8 }}>{`@${clip(card.username, 22)}`}</div>
                {stats.length > 0 && (
                  <div style={{ display: 'flex', gap: 44, marginTop: 36, paddingTop: 32, borderTop: `1px solid ${LINE}` }}>
                    {stats.slice(0, 4).map((s) => (
                      <Stat key={s.label} kind={s.kind} value={s.value} label={s.label} />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Logo size={110} />
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginTop: 26 }}>SomeShelf</div>
            <div style={{ display: 'flex', fontSize: 28, color: MUTED, marginTop: 10 }}>Your books and films, all in one shelf.</div>
          </div>
        )}

        {/* bottom spacer so the middle block sits centred between logo and edge */}
        <div style={{ display: 'flex', height: 34 }} />
      </div>
    ),
    { ...PROFILE_IMAGE_SIZE, fonts },
  )
}
