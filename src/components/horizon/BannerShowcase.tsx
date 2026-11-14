'use client'

import { Link } from '@/lib/router'
import { IoColorPaletteOutline } from 'react-icons/io5'
import { UserPreview, type CardData } from '@/components/ui/UserHoverCard'
import GlowingHorizon from '@/components/badges/GlowingHorizon'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { isHorizon } from '@/lib/horizon'
import { userPath } from '@/lib/paths'

// A made-up reader, shown as the hover card other people see over a name. Same
// person twice: with a plain colour banner (everyone) and with a banner image
// (Horizon).
const DICKENS: CardData = {
  horizon: true,
  profile: {
    id: 1812,
    name: 'Charles Dickens',
    username: 'cdickens',
    avatarUrl: '/horizon/dickens.jpg',
    bannerUrl: '/horizon/fireplace.jpg',
  },
  counts: { book: 128, movie: 1, series: 0 },
  avg: 4.5,
  progress: {
    total: 2,
    items: [
      {
        id: 'demo-book',
        type: 'book',
        title: 'It Ends with Us',
        author: 'Colleen Hoover',
        coverUrl: 'https://covers.openlibrary.org/b/id/15123232-M.jpg',
      },
      {
        id: 'demo-movie',
        type: 'movie',
        title: 'Beetlejuice',
        author: 'Tim Burton',
        coverUrl: 'https://image.tmdb.org/t/p/w500/nnl6OWkyPpuMm595hmAxNW3rZFn.jpg',
      },
    ],
  },
}

// The hover card's own chrome (see UserHoverCard), so the demo looks like the real thing.
function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        // A picture of the card, not a live one: nothing in it can be clicked.
        {...({ inert: true } as object)}
        aria-hidden
        className="pointer-events-none w-64 max-w-full select-none overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] shadow-2xl"
      >
        {children}
      </div>
      <figcaption className="text-center text-xs font-medium text-[var(--text-muted)]">{label}</figcaption>
    </figure>
  )
}

// The /horizon section on banners: the two choices side by side, on the card people
// see when they hover your name.
export default function BannerShowcase() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const member = isHorizon(user?.horizon)

  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-[var(--text)]">{t('horizonBannerTitle')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{t('horizonBannerDesc')}</p>

      <div className="mt-5 grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2">
        <Frame label={t('horizonBannerEveryone')}>
          <UserPreview card={{ ...DICKENS, horizon: false, profile: { ...DICKENS.profile, bannerUrl: undefined, bannerColor: '7A2B1D' } }} />
        </Frame>
        <Frame label={t('horizonBannerHorizon')}>
          <UserPreview card={DICKENS} />
        </Frame>
      </div>

      {user && (
        <Link
          to={`${userPath(user.username)}/edit`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
        >
          {member ? <GlowingHorizon /> : <IoColorPaletteOutline className="h-4 w-4" />}
          {t('horizonEditBanner')}
        </Link>
      )}
    </section>
  )
}
