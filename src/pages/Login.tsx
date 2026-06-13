import { IoStar, IoKeyOutline } from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { redirectToNonsLogin } from '../lib/api'
import { compactCount } from '../services/catalogService'

// Signed-out landing page for the library. Visually its own thing — a dim
// "screening room" with slowly drifting shelves of covers — rather than a copy
// of the nons intro page. Sign-in happens through the shared nons account
// (SSO); after logout you land here, not back on the nons sign-in form.

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

const quotes = [
  { itemIndex: 1, handle: '@vera.reads', key: 'landingQuote1', fallback: 'Finally one shelf for everything — I rate a film and my friends actually see it.' },
  { itemIndex: 0, handle: '@kos', key: 'landingQuote2', fallback: 'The “in progress” shelf quietly replaced three apps for me.' },
  { itemIndex: 5, handle: '@arina', key: 'landingQuote3', fallback: 'Recommendations come from my circle on nons, not from an algorithm.' },
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

function ShelfRow({ items, reverse }: { items: Cover[]; reverse?: boolean }) {
  // Two copies back-to-back so the 50% translate loops seamlessly.
  const doubled = [...items, ...items]
  return (
    <div className="flex w-max gap-4" style={{ animation: `shelf-drift 70s linear infinite ${reverse ? 'reverse' : ''}` }}>
      {doubled.map((item, i) => (
        <div
          key={`${item.title}-${i}`}
          className="relative w-32 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--container-2)]"
          style={{ aspectRatio: '2 / 3' }}
        >
          <img src={item.src} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
            <IoStar className="h-2.5 w-2.5 text-nonspremium" />
            <span className="text-[10px] font-semibold text-white">{item.rating.toFixed(1)}</span>
            <span className="text-[10px] text-white/60">· {compactCount(item.ratings)}</span>
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
          to { transform: translateX(-50%); }
        }
      `}</style>

      {/* ── top bar ───────────────────────────────────────────────── */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <img src="/shelf.svg" alt="Nons Shelf" className="h-6 w-6" />
          <span className="text-base font-semibold tracking-tight">Nons Shelf</span>
        </div>
        <button
          onClick={redirectToNonsLogin}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
        >
          {t('login') || 'Sign in'}
        </button>
      </header>

      {/* ── hero: drifting shelves behind centered copy ──────────── */}
      <section className="relative overflow-hidden">
        {items.length > 0 && (
          <div className="absolute inset-0 -rotate-2 scale-110 opacity-30">
            <div className="mt-2 overflow-hidden">
              <ShelfRow items={items.slice(0, half)} />
            </div>
            <div className="mt-4 overflow-hidden">
              <ShelfRow items={items.slice(half)} reverse />
            </div>
            <div className="mt-4 overflow-hidden">
              <ShelfRow items={items.slice(0, half)} />
            </div>
          </div>
        )}
        {/* vignette so the copy stays readable over the wall */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 65% at 50% 45%, rgba(13,13,14,0.94) 0%, rgba(13,13,14,0.72) 55%, rgba(13,13,14,0.35) 100%)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] to-transparent" />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center sm:py-36">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.25em] text-nonsprimary">
            {t('landingEyebrow') || 'Part of the nons family'}
          </p>
          <h1 className="text-4xl font-light leading-[1.12] tracking-tight sm:text-6xl">
            {t('landingTitle') || 'Every book and film you love,'}{' '}
            <span className="text-[var(--text-muted)]">{t('landingTitle2') || 'on one shelf.'}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--text-muted)]">
            {t('landingSubtitle') ||
              'Track what you read and watch, rate it, and see what your friends on nons are into — without the noise.'}
          </p>
          <button
            onClick={redirectToNonsLogin}
            className="mt-9 rounded-xl bg-nonsprimary px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[var(--primary-soft)] transition-colors hover:bg-nonsprimaryfocus"
          >
            {t('landingCta') || 'Continue with nons'}
          </button>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {t('landingSsoNote') || 'One nons account — sign in once, use every nons app.'}
          </p>
        </div>
      </section>

      {/* ── loved this week: review cards with real covers ───────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-6">
        <h2 className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">
          {t('landingLovedWeek') || 'Loved this week'}
        </h2>
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
                    “{t(q.key) || q.fallback}”
                  </blockquote>
                  <figcaption className="mt-2 truncate text-xs text-[var(--text-muted)]">
                    {q.handle} · {item.title}
                  </figcaption>
                </div>
              </figure>
            )
          })}
        </div>
      </section>

      {/* ── nons account band ────────────────────────────────────── */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--container)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12 text-center sm:flex-row sm:text-left">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-nonsprimary">
            <IoKeyOutline className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">{t('landingFeat3Title') || 'Powered by your nons account'}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t('landingFeat3Text') ||
                'Your profile, friends and privacy settings follow you here. No new account, no new password.'}
            </p>
          </div>
          <button
            onClick={redirectToNonsLogin}
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-nonsprimary hover:bg-[var(--primary-soft)]"
          >
            {t('landingCta') || 'Continue with nons'}
          </button>
        </div>
      </section>

      {/* ── footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">© Nons Company</p>
          <a href="https://nonsapp.com" className="text-xs text-[var(--text-muted)] transition-colors hover:text-nonsprimary">
            {t('landingFooterNons') || 'Built on the nons platform — nonsapp.com'}
          </a>
        </div>
      </footer>
    </div>
  )
}
