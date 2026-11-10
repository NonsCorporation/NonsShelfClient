import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getPublicPerson } from '@/lib/serverApi'
import { parseLang } from '@/lib/mediaLocalize'
import { langCode, lifeSpan, nameForLang, personLangs } from '@/lib/personLocalize'
import { hashHue } from '@/lib/hashHue'
import { analyzeCover, hslToRgb255 } from '@/lib/coverColorServer'
import { toVisualRtl, hasArabicScript, clipText, safeText, pickDrawable } from '@/lib/ogText'
import { avatarDataUrl, loadFonts, ONEST_STACK, ONEST_STACK_AR, Logo, BG, INK, MUTED, LINE, PRIMARY } from '@/lib/profileSeo'

// Link-preview card for a person page (/p/<uuid>), referenced from the page's
// og:image / twitter:image. Horizontal 1200x630: portrait on the left; role,
// name (spelled in `?lang=xx` when the person has that alias), life years and a
// row of covers of their works on the right.
//
// Renderer rules (see lib/profileSeo.tsx and the media card): every element with
// text is display:flex with ONE text child, and overflow:hidden doesn't clip —
// so images round themselves.

export const runtime = 'nodejs'

const SIZE = { width: 1200, height: 630 }
const PORTRAIT = { width: 300, height: 450 } // 2:3
const COVER = { width: 88, height: 132 } // 2:3
const MAX_COVERS = 5

// Shown as a small tag above the name; the most "defining" role present wins.
const ROLE_TAG: [string, string][] = [
  ['author', 'AUTHOR'], ['director', 'DIRECTOR'], ['actor', 'ACTOR'], ['writer', 'WRITER'], ['translator', 'TRANSLATOR'],
]

// Arabic is drawn on one line (wrapping would break the right-to-left order), so
// shrink the type until the line fits `width` (~0.55em per glyph).
function fitLine(chars: number, width: number, max: number): number {
  return Math.max(26, Math.min(max, Math.floor(width / (Math.max(chars, 1) * 0.55))))
}

// Longer names get smaller type so they stay within ~3 lines.
function nameSize(name: string): number {
  if (name.length <= 16) return 88
  if (name.length <= 28) return 70
  if (name.length <= 44) return 56
  return 44
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params
  const want = parseLang(req.nextUrl.searchParams.get('lang') ?? undefined)

  const [data, fonts] = await Promise.all([getPublicPerson(uuid), loadFonts({ arabic: true })])
  const headers = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' }

  const brandCard = () =>
    new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, background: BG, color: INK, fontFamily: ONEST_STACK }}>
          <Logo size={110} />
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700 }}>SomeShelf</div>
        </div>
      ),
      { ...SIZE, fonts, headers },
    )

  if (!data) return brandCard()

  const { person, aliases, credits } = data
  const lang = want && personLangs(person, aliases).includes(want) ? want : ''

  // Distinct works, newest first (credits arrive newest-first); only ones with art get a tile.
  const seen = new Set<string>()
  const works = credits.map((c) => c.media).filter((m) => (seen.has(m.uuid) ? false : (seen.add(m.uuid), true)))
  const withArt = works.filter((m) => m.cover_url).slice(0, MAX_COVERS)

  const [rawPhoto, ...coverData] = await Promise.all([
    avatarDataUrl(person.photo_url ? person.photo_url.replace(/^http:\/\//i, 'https://') : undefined),
    ...withArt.map((m) => avatarDataUrl(m.cover_url!.replace(/^http:\/\//i, 'https://'))),
  ])
  const covers = coverData.filter((c): c is string => !!c)
  // The card's glow is the photo's dominant colour, like the media card's is the
  // cover's. A missing/1px photo has none, so that case falls back to a colour
  // derived from the name (the same one the initial-letter placeholder uses).
  const { usable, rgb } = await analyzeCover(rawPhoto)
  const photoData = usable ? rawPhoto : null

  // The localized spelling first; if our fonts can't draw it (CJK etc.) fall back
  // to the canonical name, then any other drawable spelling.
  const localized = nameForLang(person, aliases, lang)
  const rawName = pickDrawable([localized, person.name, ...aliases.filter((a) => !a.lang || langCode(a.lang) !== lang).map((a) => a.name)])
  const rtl = hasArabicScript(rawName)
  const logicalName = clipText(rawName, rtl ? 50 : 70)
  const name = rtl ? toVisualRtl(logicalName, lang) : logicalName
  const life = lifeSpan(person)
  const roles = new Set(credits.map((c) => c.role))
  const tag = ROLE_TAG.find(([r]) => roles.has(r))?.[1] ?? 'PERSON'
  const hue = hashHue(rawName)
  const glow = rgb ?? hslToRgb255(hue, 0.6, 0.5)
  const initial = safeText(rawName).charAt(0).toUpperCase() || '?'

  const card = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 64px 44px',
        color: INK,
        fontFamily: ONEST_STACK_AR,
        background: `radial-gradient(ellipse 90% 140% at 22% 50%, rgba(${glow.join(',')},0.8), transparent 75%), ${BG}`,
      }}
    >
      {/* brand, top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Logo size={30} />
        <div style={{ display: 'flex', fontSize: 18, letterSpacing: 5, color: INK }}>SOMESHELF.COM</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
        {photoData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoData} width={PORTRAIT.width} height={PORTRAIT.height} style={{ borderRadius: 18, objectFit: 'cover', border: `2px solid ${LINE}` }} alt="" />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: PORTRAIT.width,
              height: PORTRAIT.height,
              borderRadius: 18,
              border: `2px solid ${LINE}`,
              background: `hsl(${hue}, 22%, 15%)`,
              fontSize: 150,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {initial}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, color: PRIMARY, fontWeight: 700 }}>{tag}</div>
          <div style={{ display: 'flex', fontSize: rtl ? fitLine(name.length, 716, 88) : nameSize(name), fontWeight: 700, lineHeight: 1.08, marginTop: 14, whiteSpace: rtl ? 'nowrap' : 'normal' }}>
            {name}
          </div>
          {life ? <div style={{ display: 'flex', fontSize: 34, color: MUTED, marginTop: 18 }}>{life}</div> : null}

          {works.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, paddingTop: 26, borderTop: `1px solid ${LINE}` }}>
              <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: MUTED }}>
                {`${works.length.toLocaleString('en-US')} ${works.length === 1 ? 'WORK' : 'WORKS'}`}
              </div>
              {covers.length > 0 ? (
                <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
                  {covers.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} width={COVER.width} height={COVER.height} style={{ borderRadius: 10, objectFit: 'cover', border: `1px solid ${LINE}` }} alt="" />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* bottom spacer keeps the middle block centred */}
      <div style={{ display: 'flex', height: 8 }} />
    </div>
  )

  // Render eagerly so a renderer failure is caught here (a lazily streamed
  // ImageResponse would surface as a bare 500); fall back to the brand card.
  try {
    const png = await new ImageResponse(card, { ...SIZE, fonts }).arrayBuffer()
    return new Response(png, { headers: { 'Content-Type': 'image/png', ...headers } })
  } catch (err) {
    console.error('og/person render failed', uuid, lang, err)
    return brandCard()
  }
}
