import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getPublicMedia, getPublicRating } from '@/lib/serverApi'
import { loadLocalizations, localizedFor, parseLang } from '@/lib/mediaLocalize'
import { hashHue } from '@/lib/hashHue'
import { analyzeCover, hslToRgb255 } from '@/lib/coverColorServer'
import { toVisualRtl, hasArabicScript, clipText, safeText, pickDrawable } from '@/lib/ogText'
import { avatarDataUrl, loadFonts, ONEST_STACK, ONEST_STACK_AR, Logo, BG, INK, MUTED, LINE, PRIMARY } from '@/lib/profileSeo'

// Link-preview card for a book/film/series page (/b/<id>, /m/<id>), referenced
// from the page's og:image / twitter:image. Horizontal 1200x630: cover on the
// left; type, title, director/author + year and the community score on the
// right. `?lang=xx` renders the localized title, matching the localized page.
//
// Renderer rules (learned the hard way in lib/profileSeo.tsx): every element
// with text is display:flex with ONE text child, icons are a single <path>, and
// overflow:hidden doesn't clip — so the cover rounds itself.

export const runtime = 'nodejs'

const SIZE = { width: 1200, height: 630 }
const COVER = { width: 300, height: 450 } // 2:3

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
const TYPE_LABEL = { book: 'BOOK', movie: 'FILM', series: 'SERIES' } as Record<string, string>

const clip = clipText
const safe = safeText

/** First candidate fully drawable with our fonts (see lib/ogText). */
const pickTitle = (candidates: (string | undefined)[]) => pickDrawable(candidates)

// Arabic is drawn on one line (wrapping would break the right-to-left order),
// so shrink the type until the line fits `width` (~0.55em per glyph).
function fitLine(chars: number, width: number, max: number): number {
  return Math.max(26, Math.min(max, Math.floor(width / (Math.max(chars, 1) * 0.55))))
}

// Longer titles get smaller type so they stay within ~3 lines.
function titleSize(title: string): number {
  if (title.length <= 18) return 84
  if (title.length <= 34) return 68
  if (title.length <= 56) return 54
  return 44
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const lang = parseLang(req.nextUrl.searchParams.get('lang') ?? undefined)

  const [media, fonts] = await Promise.all([getPublicMedia(id), loadFonts({ arabic: true })])
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

  if (!media) return brandCard()

  const [loc, rating, coverData] = await Promise.all([
    loadLocalizations(media, id),
    getPublicRating(String(media.id)),
    avatarDataUrl(media.cover_url ? media.cover_url.replace(/^http:\/\//i, 'https://') : undefined),
  ])
  const localized = localizedFor(media, loc, lang)
  const { usable, rgb } = await analyzeCover(coverData)
  const cover = usable ? coverData : null
  const rawTitle = pickTitle([localized?.title, media.title, media.original_title])
  // No cover: the same generated placeholder as the statistics page (hue from
  // title + author). The glow takes that hue too, since there's no artwork.
  const hue = hashHue(`${rawTitle}${media.author || ''}`)
  const glow = rgb ?? hslToRgb255(hue, 0.6, 0.5)
  const rtl = hasArabicScript(rawTitle)
  const logicalTitle = clip(rawTitle, rtl ? 60 : 90)
  // Arabic must be pre-shaped and put in visual order for the renderer.
  const title = rtl ? toVisualRtl(logicalTitle, lang) : logicalTitle
  const byline = safe((media.type === 'book' ? media.author : media.director) || '')
  const meta = [byline, media.year ? String(media.year) : ''].filter(Boolean).join('  ·  ')

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
          background: `radial-gradient(circle at 18% 50%, rgba(${glow.join(',')},0.55), transparent 60%), ${BG}`,
        }}
      >
        {/* brand, top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo size={30} />
          <div style={{ display: 'flex', fontSize: 18, letterSpacing: 5, color: INK }}>SOMESHELF.COM</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} width={COVER.width} height={COVER.height} style={{ borderRadius: 18, objectFit: 'cover', border: `2px solid ${LINE}` }} alt="" />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: COVER.width,
                height: COVER.height,
                padding: 24,
                borderRadius: 18,
                border: `2px solid ${LINE}`,
                background: `hsl(${hue}, 22%, 15%)`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.75)' }}>
                {clip(byline, 28)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', fontSize: rtl ? fitLine(title.length, 252, 38) : 38, fontWeight: 700, lineHeight: 1.15, whiteSpace: rtl ? 'nowrap' : 'normal' }}>
                {rtl ? title : clip(title, 60)}
              </div>
              <div style={{ display: 'flex' }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, color: PRIMARY, fontWeight: 700 }}>
              {TYPE_LABEL[media.type] ?? 'MEDIA'}
            </div>
            <div style={{ display: 'flex', fontSize: rtl ? fitLine(title.length, 716, 84) : titleSize(title), fontWeight: 700, lineHeight: 1.08, marginTop: 14, whiteSpace: rtl ? 'nowrap' : 'normal' }}>
              {title}
            </div>
            {meta ? (
              <div style={{ display: 'flex', fontSize: 34, color: MUTED, marginTop: 18 }}>{clip(meta, 60)}</div>
            ) : null}

            {rating.count > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 36, paddingTop: 28, borderTop: `1px solid ${LINE}` }}>
                <svg width={52} height={52} viewBox="0 0 24 24">
                  <path d={STAR_PATH} fill={PRIMARY} />
                </svg>
                <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1 }}>{rating.average.toFixed(1)}</div>
                <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 22 }}>
                  {`/ 10  ·  ${rating.count.toLocaleString('en-US')} ${rating.count === 1 ? 'RATING' : 'RATINGS'}`}
                </div>
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
    console.error('og/media render failed', id, lang, err)
    return brandCard()
  }
}
