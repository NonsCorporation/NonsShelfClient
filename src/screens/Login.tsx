import { IoStar, IoKeyOutline, IoLayersOutline, IoPeopleOutline, IoBookmarksOutline, IoCompassOutline } from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { redirectToNonsLogin } from '../lib/api'
import { compactCount } from '../services/catalogService'
import ShelfLogo from '../components/ShelfLogo'

// Signed-out landing page for the library. Visually its own thing — a dim
// "screening room" with slowly drifting shelves of covers — rather than a copy
// of the nons intro page. Sign-in happens through the shared nons account
// (SSO); after logout you land here, not back on the nons sign-in form.

// Structure mirrors the nons-client About page: a hero, then numbered editorial
// sections (§ 01…). It keeps the library's own tokens/typography rather than
// copying nons-client's classes, so it still reads as its own product.

// The covers come from bundled static assets (public/covers/*) rather than the
// catalog API: this page is shown while signed OUT, so the authed /api/media
// call would 401 and leave the shelves empty. Books from Open Library, film
// posters from TMDB.
type Cover = { title: string; src: string; rating: number; ratings: number }

const COVERS: Cover[] = [
  { title: 'Inception', src: '/covers/film-inception.jpg', rating: 8.8, ratings: 2400000 },
  { title: 'Dune', src: '/covers/book-dune.jpg', rating: 8.6, ratings: 412000 },
  { title: 'The Dark Knight', src: '/covers/film-darkknight.jpg', rating: 9.0, ratings: 2700000 },
  { title: 'The Lord of the Rings', src: '/covers/book-lotr.jpg', rating: 9.0, ratings: 720000 },
  { title: 'Interstellar', src: '/covers/film-interstellar.jpg', rating: 8.7, ratings: 1900000 },
  { title: 'A Game of Thrones', src: '/covers/book-got.jpg', rating: 8.8, ratings: 690000 },
  { title: 'Pulp Fiction', src: '/covers/film-pulpfiction.jpg', rating: 8.9, ratings: 2100000 },
  { title: 'The Martian', src: '/covers/book-martian.jpg', rating: 8.7, ratings: 410000 },
  { title: 'The Matrix', src: '/covers/film-matrix.jpg', rating: 8.7, ratings: 1900000 },
  { title: "Harry Potter and the Philosopher's Stone", src: '/covers/book-hp1.jpg', rating: 8.9, ratings: 1100000 },
  { title: 'Parasite', src: '/covers/film-parasite.jpg', rating: 8.5, ratings: 900000 },
  { title: 'Mistborn', src: '/covers/book-mistborn.jpg', rating: 8.4, ratings: 98000 },
  { title: 'Brave New World', src: '/covers/book-bravenew.jpg', rating: 8.1, ratings: 330000 },
  { title: 'The Way of Kings', src: '/covers/book-wayofkings.jpg', rating: 8.9, ratings: 150000 },
  { title: 'Fahrenheit 451', src: '/covers/book-fahrenheit.jpg', rating: 8.0, ratings: 280000 },
  { title: 'The Catcher in the Rye', src: '/covers/book-catcher.jpg', rating: 7.8, ratings: 540000 },
]

const FEATURES = [
  { Icon: IoLayersOutline, titleKey: 'landingGrid1Title', descKey: 'landingGrid1Text' },
  { Icon: IoPeopleOutline, titleKey: 'landingGrid2Title', descKey: 'landingGrid2Text' },
  { Icon: IoBookmarksOutline, titleKey: 'landingGrid3Title', descKey: 'landingGrid3Text' },
  { Icon: IoCompassOutline, titleKey: 'landingGrid4Title', descKey: 'landingGrid4Text' },
]

const STEPS = [
  { titleKey: 'landingStep1Title', textKey: 'landingStep1Text' },
  { titleKey: 'landingStep2Title', textKey: 'landingStep2Text' },
  { titleKey: 'landingStep3Title', textKey: 'landingStep3Text' },
]

const COMPARE = [
  { labelKey: 'landingCmpLabel1', themKey: 'landingCmpThem1', usKey: 'landingCmpUs1' },
  { labelKey: 'landingCmpLabel2', themKey: 'landingCmpThem2', usKey: 'landingCmpUs2' },
  { labelKey: 'landingCmpLabel3', themKey: 'landingCmpThem3', usKey: 'landingCmpUs3' },
  { labelKey: 'landingCmpLabel4', themKey: 'landingCmpThem4', usKey: 'landingCmpUs4' },
]

const quotes = [
  { itemIndex: 1, handle: '@vera.reads', key: 'landingQuote1' },
  { itemIndex: 0, handle: '@kos', key: 'landingQuote2' },
  { itemIndex: 5, handle: '@arina', key: 'landingQuote3' },
]

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating / 2)
  return (
    <span className="flex items-center gap-0.5 text-nonspremium">
      {Array.from({ length: 5 }, (_, i) => (
        <IoStar key={i} className={`h-3 w-3 ${i < full ? '' : 'opacity-25'}`} />
      ))}
    </span>
  )
}

// Numbered editorial divider, e.g.  § 02 ───────────── How it works
function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mb-12 flex items-center gap-4">
      <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--text-muted)] opacity-50">{n}</span>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--text-muted)]">{children}</span>
    </div>
  )
}

function ShelfRow({ items, reverse }: { items: Cover[]; reverse?: boolean }) {
  const doubled = [...items, ...items]
  return (
    <div className="flex w-max gap-4" style={{ animation: `shelf-drift 70s linear infinite ${reverse ? 'reverse' : ''}` }}>
      {doubled.map((item, i) => (
        <div
          key={`${item.title}-${i}`}
          className="relative w-28 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--container-2)]"
          style={{ aspectRatio: '2 / 3' }}
        >
          <img src={item.src} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
            <IoStar className="h-2.5 w-2.5 text-nonspremium" />
            <span className="text-[10px] font-semibold text-white">{item.rating.toFixed(1)}</span>
            <span className="text-[10px] text-white/50">· {compactCount(item.ratings)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Login() {
  const { t } = useLanguage()
  const items = COVERS
  const half = Math.ceil(items.length / 2)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <style>{`
        @keyframes shelf-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      {/* ── top bar ── */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--border-subtle)] backdrop-blur-md"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <ShelfLogo className="h-7 w-7 text-white" />
            <span className="text-base font-semibold tracking-tight">Nons Shelf</span>
          </div>
          <button
            onClick={redirectToNonsLogin}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
          >
            {t('login')}
          </button>
        </div>
      </header>

      {/* ── hero: drifting shelves behind centered copy ── */}
      <section className="relative overflow-hidden">
        {items.length > 0 && (
          <div className="absolute inset-0 -rotate-2 scale-110 opacity-35">
            <div className="mt-2 overflow-hidden">
              <ShelfRow items={items.slice(0, half)} />
            </div>
            <div className="mt-4 overflow-hidden">
              <ShelfRow items={items.slice(half)} reverse />
            </div>
            <div className="mt-4 overflow-hidden">
              <ShelfRow items={items.slice(0, half)} />
            </div>
            <div className="mt-4 overflow-hidden">
              <ShelfRow items={items.slice(half)} reverse />
            </div>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 68% 60% at 50% 45%, rgba(13,13,14,0.97) 0%, rgba(13,13,14,0.80) 52%, rgba(13,13,14,0.40) 100%)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] to-transparent" />

        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 py-28 text-center sm:py-40">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.25em] text-nonsprimary">
            {t('landingEyebrow')}
          </p>
          <h1 className="text-4xl font-light leading-[1.12] tracking-tight sm:text-6xl">
            {t('landingTitle')}{' '}
            <span className="text-[var(--text-muted)]">{t('landingTitle2')}</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--text-muted)]">
            {t('landingSubtitle')}
          </p>
          <button
            onClick={redirectToNonsLogin}
            className="mt-9 rounded-xl bg-nonsprimary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-nonsprimary/25 transition-all hover:bg-nonsprimaryfocus hover:shadow-nonsprimary/35"
          >
            {t('landingCta')}
          </button>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {t('landingSsoNote')}
          </p>
        </div>
      </section>

      {/* ── § 01 · what you get ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 01">{t('landingSec1')}</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-6 transition-colors hover:border-[var(--border)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)]">
                  <Icon className="h-5 w-5 text-nonsprimary" />
                </div>
                <h3 className="text-sm font-semibold leading-snug">{t(titleKey)}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 02 · how it works ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 02">{t('landingSec2')}</SectionLabel>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.titleKey} className="group">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-sm tabular-nums text-nonsprimary">{String(i + 1).padStart(2, '0')}</span>
                  <div className="h-px flex-1 bg-nonsprimary/20 transition-colors group-hover:bg-nonsprimary/40" />
                </div>
                <h3 className="mb-2 text-base font-semibold tracking-tight">{t(s.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{t(s.textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 03 · why it's different (comparison) ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 03">{t('landingSec3')}</SectionLabel>
          <div className="grid grid-cols-3 gap-4 px-5 pb-3">
            <div />
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-50 sm:text-[11px]">
              {t('landingCompareHeadOther')}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-nonsprimary sm:text-[11px]">
              {t('landingCompareHeadUs')}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {COMPARE.map((row, i) => (
              <div
                key={row.labelKey}
                className={`grid grid-cols-3 items-start gap-4 px-5 py-4 ${
                  i < COMPARE.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] opacity-60">{t(row.labelKey)}</span>
                <span className="text-sm leading-snug text-[var(--text-muted)]">{t(row.themKey)}</span>
                <span className="text-sm leading-snug text-[var(--text)]">{t(row.usKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 04 · loved this week ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 04">{t('landingSec4')}</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-3">
            {quotes.map((q) => {
              const item = items[q.itemIndex]
              if (!item) return null
              return (
                <figure
                  key={q.handle}
                  className="flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5"
                >
                  <div
                    className="relative w-14 flex-shrink-0 overflow-hidden rounded-md bg-[var(--container-2)]"
                    style={{ aspectRatio: '2 / 3' }}
                  >
                    <img src={item.src} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <Stars rating={item.rating} />
                    <blockquote className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                      "{t(q.key)}"
                    </blockquote>
                    <figcaption className="mt-2 truncate text-xs text-[var(--text-muted)]">
                      {q.handle} · {item.title}
                    </figcaption>
                  </div>
                </figure>
              )
            })}
          </div>
          <p className="mt-10 text-center text-xs leading-relaxed text-[var(--text-muted)] opacity-70">
            {t('landingSourcesNote')}
          </p>
        </div>
      </section>

      {/* ── nons account band ── */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--container)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12 text-center sm:flex-row sm:text-left">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimary">
            <IoKeyOutline className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{t('landingFeat3Title')}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t('landingFeat3Text')}
            </p>
          </div>
          <button
            onClick={redirectToNonsLogin}
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
          >
            {t('landingCta')}
          </button>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-[var(--border-subtle)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">© Nons Company</p>
          <a href="https://nonsapp.com" className="text-xs text-[var(--text-muted)] transition-colors hover:text-nonsprimary">
            {t('landingFooterNons')}
          </a>
        </div>
      </footer>
    </div>
  )
}
