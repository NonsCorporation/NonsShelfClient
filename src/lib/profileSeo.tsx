import 'server-only'
import type { Metadata } from 'next'
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublicProfileCard, type PublicProfileCard } from './serverApi'

// SEO for public profile links (/u/<username>): the page <title>, description,
// OpenGraph/Twitter tags, JSON-LD, and the link-preview image — an
// Instagram-share-style card (gradient background, white card, ringed photo,
// name, @handle, bio, short stats). Everything comes from the anonymous-safe
// profile card, so it never shows more than the owner's privacy settings allow.

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
async function loadFonts() {
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
async function avatarDataUrl(url?: string): Promise<string | null> {
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

const INK = '#15151f'
const MUTED = '#7b7b8c'
const BRAND = '#6768ab'
// Instagram-story-like ring, in SomeShelf's colours.
const RING = 'linear-gradient(135deg, #f0a35e 0%, #d4688f 45%, #6768ab 100%)'

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="86 89 340 340" fill="#ffffff">
      <g transform="translate(89.6, 89.6) scale(0.65)">
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(2.446384,0,0,2.4904064,-337.33813,-404.93892)" />
        <path d="m 281.77771,168.55891 a 58.151039,58.151039 47.226629 0 1 55.84784,60.36644 v 137.13181 h -55.84784 z" transform="matrix(-2.446384,0,0,2.4904064,837.74641,-411.14917)" />
      </g>
      <rect x="211" y="112" width="90" height="200" rx="16" />
      <circle cx="256" cy="376" r="42" />
    </svg>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 44, fontWeight: 700, color: INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 20, color: MUTED, marginTop: 8 }}>{label}</div>
    </div>
  )
}

/** Renders the link-preview card for /u/<id> (falls back to a plain brand card
 *  when the profile can't be loaded). */
export async function renderProfileImage(id: string): Promise<ImageResponse> {
  const [card, fonts] = await Promise.all([getPublicProfileCard(id), loadFonts()])
  const avatar = card ? await avatarDataUrl(card.avatar_url) : null

  const stats: { value: string; label: string }[] = []
  if (card?.stats) {
    const s = card.stats
    if (s.books) stats.push({ value: String(s.books), label: s.books === 1 ? 'book' : 'books' })
    if (s.movies) stats.push({ value: String(s.movies), label: s.movies === 1 ? 'film' : 'films' })
    if (s.series) stats.push({ value: String(s.series), label: 'series' })
  }
  if (card?.rating) stats.push({ value: `★ ${card.rating.average.toFixed(1)}`, label: 'avg rating' })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'Onest',
          background: 'linear-gradient(135deg, #2c2d5e 0%, #6768ab 45%, #b5679a 78%, #f0a35e 100%)',
        }}
      >
        {/* soft light blobs, like a story background */}
        <div style={{ position: 'absolute', top: -160, left: -120, width: 520, height: 520, borderRadius: 9999, background: 'rgba(255,255,255,0.10)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -200, right: -140, width: 600, height: 600, borderRadius: 9999, background: 'rgba(255,255,255,0.08)', display: 'flex' }} />

        {card ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 1010,
              padding: '48px 56px',
              gap: 52,
              background: '#ffffff',
              borderRadius: 44,
              boxShadow: '0 30px 80px rgba(20, 16, 50, 0.35)',
            }}
          >
            {/* ringed photo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 224, height: 224, borderRadius: 9999, background: RING, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 208, height: 208, borderRadius: 9999, background: '#ffffff' }}>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} width={192} height={192} style={{ borderRadius: 9999, objectFit: 'cover' }} alt="" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 192, height: 192, borderRadius: 9999, background: BRAND, color: '#ffffff', fontSize: 72, fontWeight: 700 }}>
                    {initials(card.name)}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 58, fontWeight: 700, color: INK, lineHeight: 1.05 }}>{clip(card.name, 26)}</div>
              <div style={{ fontSize: 30, color: BRAND, marginTop: 8 }}>@{clip(card.username, 30)}</div>
              {card.bio && (
                <div style={{ fontSize: 24, color: '#4a4a5a', marginTop: 18, lineHeight: 1.35 }}>{clip(card.bio, 110)}</div>
              )}
              {stats.length > 0 && (
                <div style={{ display: 'flex', gap: 40, marginTop: 30 }}>
                  {stats.slice(0, 4).map((s) => (
                    <Stat key={s.label} value={s.value} label={s.label} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ffffff' }}>
            <Logo size={120} />
            <div style={{ fontSize: 64, fontWeight: 700, marginTop: 28 }}>SomeShelf</div>
            <div style={{ fontSize: 30, marginTop: 10, opacity: 0.9 }}>Your books and films, all in one shelf.</div>
          </div>
        )}

        {/* footer: brand + link (the fallback card already is the brand) */}
        {card && (
          <div style={{ position: 'absolute', bottom: 30, display: 'flex', alignItems: 'center', gap: 14, color: '#ffffff', fontSize: 26 }}>
            <Logo size={34} />
            <div style={{ display: 'flex', fontWeight: 700 }}>SomeShelf</div>
            <div style={{ display: 'flex', opacity: 0.85 }}>· someshelf.com/u/{clip(card.username, 30)}</div>
          </div>
        )}
      </div>
    ),
    { ...PROFILE_IMAGE_SIZE, fonts },
  )
}
