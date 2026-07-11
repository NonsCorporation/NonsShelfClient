import React from 'react'
import {
  IoStar,
  IoKeyOutline,
  IoLayersOutline,
  IoPeopleOutline,
  IoBookmarksOutline,
  IoCompassOutline,
  IoBookOutline,
  IoFilmOutline,
  IoTvOutline,
  IoTimeOutline,
  IoCloudUploadOutline,
  IoDownloadOutline,
  IoFolderOutline,
  IoLockClosedOutline,
  IoCalendarOutline,
  IoCheckmarkCircleOutline,
  IoStarOutline,
  IoChatbubbleOutline,
  IoSpeedometerOutline,
} from 'react-icons/io5'
import { useLanguage } from '../contexts/LanguageContext'
import { redirectToNonsLogin } from '../lib/api'
import { compactCount } from '../services/catalogService'
import ShelfLogo from '@/components/branding/ShelfLogo'
import NonsLogo from '@/components/branding/NonsLogo'

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
  {
    Icon: IoLayersOutline,
    title: 'Books, films and series — one shelf',
    desc: 'No more switching between apps. Everything you read and watch lives in one place, with one account.',
  },
  {
    Icon: IoPeopleOutline,
    title: 'Friends pick better than algorithms',
    desc: "See exactly what the people you follow on nons are reading and watching. Real taste, real context.",
  },
  {
    Icon: IoBookmarksOutline,
    title: 'Four shelves. Zero ambiguity.',
    desc: '"Want to", "In progress", "Finished" and "Did not finish". Every item always has a clear home.',
  },
  {
    Icon: IoCompassOutline,
    title: 'Discover what to pick up next',
    desc: 'Browse trending titles, explore by genre, or see what\'s moving through your network right now.',
  },
  {
    Icon: IoTimeOutline,
    title: 'Know exactly where you are',
    desc: 'Log the page you\'re on, episodes watched, daily reading pace. Progress that means something.',
  },
  {
    Icon: IoCloudUploadOutline,
    title: 'Bring your history, take it back',
    desc: 'Import from a CSV or Goodreads export — ratings, dates and all. Export to CSV or JSON anytime.',
  },
]

const MEDIA_CARDS = [
  {
    Icon: IoBookOutline,
    color: '#e0a458',
    title: 'Books',
    tagline: 'From page one to the last word.',
    features: [
      'Page-by-page reading progress',
      'Reading dates and daily pace',
      'Edition and ISBN lookup',
      'Private notes only you can see',
    ],
  },
  {
    Icon: IoFilmOutline,
    color: '#7c8cff',
    title: 'Films',
    tagline: 'Every viewing, properly logged.',
    features: [
      'Director, cast and crew credits',
      'Date watched — rewatches too',
      'Half-star ratings up to 5',
      'Community and personal reviews',
    ],
  },
  {
    Icon: IoTvOutline,
    color: '#4fd1c5',
    title: 'Series',
    tagline: 'Never lose your place again.',
    features: [
      'Episode-by-episode tracking',
      'Season and overall progress',
      'Dropped, watching, or finished',
      'See what friends are bingeing',
    ],
  },
]

const POWER = [
  {
    Icon: IoCloudUploadOutline,
    title: 'Bring your library with you',
    desc: 'Import any CSV or a Goodreads shelf export. Ratings, reading dates and shelves arrive intact — no starting from zero.',
    wide: true,
  },
  {
    Icon: IoFolderOutline,
    title: 'Collections',
    desc: 'Group items beyond the default shelves. "Books about space", "Girls\' night films" — any list that makes sense to you.',
    wide: false,
  },
  {
    Icon: IoCalendarOutline,
    title: 'Monthly calendar',
    desc: 'Every finished book, film and episode placed on the date you wrapped it. Your year of reading and watching, at a glance.',
    wide: false,
  },
  {
    Icon: IoLockClosedOutline,
    title: 'Private notes',
    desc: 'Quotes, spoiler reactions, reminders to re-read. Attached to the item, invisible to everyone else.',
    wide: false,
  },
  {
    Icon: IoDownloadOutline,
    title: 'Export anytime',
    desc: 'Pick your fields, choose CSV or JSON, download. Your data is yours — no lock-in, ever.',
    wide: false,
  },
]

const STEPS = [
  {
    title: 'Find it',
    text: 'Search any book, film or series. The catalog draws on Open Library, TMDB and Google Books — millions of titles, one search.',
  },
  {
    title: 'Shelf it',
    text: 'Add to "Want to", move to "In progress", mark it finished. Rate it out of five stars, write a line or a full review.',
  },
  {
    title: 'Share it',
    text: 'Your activity reaches the nons friends you choose. Their shelves and ratings show up in your feed — no strangers, no noise.',
  },
]

const COMPARE = [
  { label: 'Books & films', them: 'Two separate apps', us: 'One shelf for both' },
  { label: 'Recommendations', them: 'Engagement algorithm', us: 'People you actually follow' },
  { label: 'Your account', them: 'Yet another sign-up', us: 'Your existing nons account' },
  { label: 'Your data', them: 'Fuel for ad targeting', us: 'Yours — no ads, no tracking' },
  { label: 'Series tracking', them: 'Title-level only', us: 'Season and episode level' },
  { label: 'Progress tracking', them: 'Finished or not', us: 'Page, episode, percentage' },
]

const QUOTES = [
  { coverIndex: 1, handle: '@vera.reads', text: 'Finally one shelf for everything — I rate a film and my friends on nons actually see it.' },
  { coverIndex: 0, handle: '@kos', text: 'The "in progress" shelf quietly replaced three apps for me.' },
  { coverIndex: 5, handle: '@arina', text: 'Recommendations come from people in my circle, not from an algorithm that wants me to keep scrolling.' },
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--container)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
      {children}
    </span>
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

      {/* ── hero ── */}
      <section className="relative overflow-hidden">
        {items.length > 0 && (
          <div className="absolute inset-0 -rotate-2 scale-110 opacity-35">
            <div className="mt-2 overflow-hidden"><ShelfRow items={items.slice(0, half)} /></div>
            <div className="mt-4 overflow-hidden"><ShelfRow items={items.slice(half)} reverse /></div>
            <div className="mt-4 overflow-hidden"><ShelfRow items={items.slice(0, half)} /></div>
            <div className="mt-4 overflow-hidden"><ShelfRow items={items.slice(half)} reverse /></div>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 68% 60% at 50% 45%, rgba(13,13,14,0.97) 0%, rgba(13,13,14,0.80) 52%, rgba(13,13,14,0.40) 100%)' }}
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
            className="mt-9 inline-flex items-center gap-2.5 rounded-xl bg-black px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-all hover:bg-neutral-800"
          >
            <NonsLogo className="h-5 w-5" />
            {t('landingCta')}
          </button>
          <p className="mt-3 text-xs text-[var(--text-muted)]">{t('landingSsoNote')}</p>

          {/* trust badges */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Pill><IoBookOutline className="h-3.5 w-3.5" /> Books · Films · Series</Pill>
            <Pill><IoStarOutline className="h-3.5 w-3.5" /> No ads, no tracking</Pill>
            <Pill><IoChatbubbleOutline className="h-3.5 w-3.5" /> Social, not algorithmic</Pill>
          </div>
        </div>
      </section>

      {/* ── § 01 · what you get ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 01">What you get</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-6 transition-colors hover:border-[var(--border)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)]">
                  <Icon className="h-5 w-5 text-nonsprimary" />
                </div>
                <h3 className="text-sm font-semibold leading-snug">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 02 · what you can track ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 02">What you can track</SectionLabel>
          <div className="grid gap-4 md:grid-cols-3">
            {MEDIA_CARDS.map(({ Icon, color, title, tagline, features }) => (
              <div
                key={title}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] transition-colors hover:border-[var(--border)]"
              >
                {/* card header */}
                <div
                  className="flex items-center gap-3 px-6 py-5"
                  style={{ backgroundColor: `${color}14` }}
                >
                  <span
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${color}22` }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold tracking-tight" style={{ color }}>{title}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{tagline}</p>
                  </div>
                </div>

                {/* feature list */}
                <ul className="flex flex-col gap-2.5 px-6 py-5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text)]">
                      <IoCheckmarkCircleOutline className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 03 · power features bento ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 03">Everything you need, nothing you don't</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {POWER.map(({ Icon, title, desc, wide }) => (
              <div
                key={title}
                className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-6 transition-colors hover:border-[var(--border)] ${
                  wide ? 'sm:col-span-2 lg:col-span-2' : ''
                }`}
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface)]">
                  <Icon className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <h3 className="text-sm font-semibold leading-snug">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 04 · how it works ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 04">How it works</SectionLabel>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="group">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-sm tabular-nums text-nonsprimary">{String(i + 1).padStart(2, '0')}</span>
                  <div className="h-px flex-1 bg-nonsprimary/20 transition-colors group-hover:bg-nonsprimary/40" />
                </div>
                <h3 className="mb-2 text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── § 05 · loved this week ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 05">Loved this week</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-3">
            {QUOTES.map((q) => {
              const item = items[q.coverIndex]
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
                      "{q.text}"
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

      {/* ── § 06 · why it's different ── */}
      <section className="border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel n="§ 06">Why it's different</SectionLabel>
          <div className="grid grid-cols-3 gap-4 px-5 pb-3">
            <div />
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] opacity-50 sm:text-[11px]">
              Everywhere else
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-nonsprimary sm:text-[11px]">
              Nons Shelf
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {COMPARE.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 items-start gap-4 px-5 py-4 ${
                  i < COMPARE.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] opacity-60">{row.label}</span>
                <span className="text-sm leading-snug text-[var(--text-muted)]">{row.them}</span>
                <span className="text-sm leading-snug text-[var(--text)]">{row.us}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── nons account band ── */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--container)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-nonsprimary">
              <IoKeyOutline className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight">{t('landingFeat3Title')}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
                {t('landingFeat3Text')}
              </p>
            </div>
            <button
              onClick={redirectToNonsLogin}
              className="inline-flex items-center gap-2.5 rounded-xl bg-black px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-all hover:bg-neutral-800"
            >
              <NonsLogo className="h-5 w-5" />
              {t('landingCta')}
            </button>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-[var(--border-subtle)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <ShelfLogo className="h-5 w-5 text-[var(--text-muted)]" />
            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">© Nons Corporation</p>
          </div>
          <a href="https://nonsapp.com" className="text-xs text-[var(--text-muted)] transition-colors hover:text-nonsprimary">
            {t('landingFooterNons')}
          </a>
        </div>
      </footer>
    </div>
  )
}
