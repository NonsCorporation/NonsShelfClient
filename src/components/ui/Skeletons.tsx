import Layout from '@/components/layout/Layout'
import { useLanguage } from '@/contexts/LanguageContext'

// Ghost placeholders shown while data (or the shared SSO session) is loading.
// Shapes mirror the real components so the actual content drops in without a
// layout shift, and the same pieces back both the feed's own loading state and
// the app-wide auth gate (RequireAuth) — so entering the app shows content-
// shaped placeholders instead of a bare "Loading…".

// Mirrors ActivityCard: avatar + name/verb lines + timestamp in the header,
// then a cover beside a few detail lines.
export function ActivityCardSkeleton() {
  return (
    <article className="-mx-4 animate-pulse rounded-none border-x-0 border-y border-[var(--border-subtle)] bg-[var(--container)] px-4 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[var(--surface-active)]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-3.5 w-2/3 rounded bg-[var(--surface-active)]" />
          <div className="h-3 w-1/3 rounded bg-[var(--surface-active)]" />
        </div>
        <div className="h-3 w-8 flex-shrink-0 rounded bg-[var(--surface-active)]" />
      </div>
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-[88px] flex-shrink-0 rounded-md bg-[var(--surface-active)]" />
        <div className="min-w-0 flex-1 space-y-2.5 py-1">
          <div className="h-5 w-3/4 rounded bg-[var(--surface-active)]" />
          <div className="h-3.5 w-1/2 rounded bg-[var(--surface-active)]" />
          <div className="h-3 w-full rounded bg-[var(--surface-active)]" />
          <div className="h-3 w-5/6 rounded bg-[var(--surface-active)]" />
        </div>
      </div>
    </article>
  )
}

// The home/feed body in its loading state: the real title and section heading,
// then a few ghost activity cards.
export function FeedSkeletonBody() {
  const { t } = useLanguage()
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('home')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('feedSubtitle')}</p>
      </div>
      <section>
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{t('friendsActivity')}</h2>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </>
  )
}

// Full app loading state: the real chrome (header / nav / ambient background)
// wrapping the feed ghost. Shown while the shared SSO session is verified.
export default function AppLoadingSkeleton() {
  return (
    <Layout>
      <FeedSkeletonBody />
    </Layout>
  )
}

// Ghost for the user profile page: identity card (avatar + name/handle + stats),
// shelf tabs, and a row of cover placeholders. Render inside <Layout>.
export function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5 sm:p-6">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 flex-shrink-0 rounded-2xl bg-[var(--surface-active)]" />
          <div className="min-w-0 flex-1 space-y-2.5 pt-1">
            <div className="h-6 w-48 rounded bg-[var(--surface-active)]" />
            <div className="h-3.5 w-24 rounded bg-[var(--surface-active)]" />
            <div className="h-3.5 w-32 rounded bg-[var(--surface-active)]" />
          </div>
        </div>
        <div className="mt-5 flex gap-8 border-t border-[var(--border-subtle)] pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-5 w-8 rounded bg-[var(--surface-active)]" />
              <div className="h-3 w-12 rounded bg-[var(--surface-active)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-4 border-b border-[var(--border-subtle)] pb-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-14 rounded bg-[var(--surface-active)]" />
        ))}
      </div>

      <div className="mt-5 flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-24 flex-shrink-0 sm:w-28">
            <div className="aspect-[2/3] rounded-lg bg-[var(--surface-active)]" />
            <div className="mt-1.5 h-2.5 w-12 rounded bg-[var(--surface-active)]" />
            <div className="mt-1 h-3 w-full rounded bg-[var(--surface-active)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Ghost for the two-column detail pages (media + person): a back link, a
// portrait/cover on the left and title/meta/body lines on the right. Render
// inside <Layout>.
export function DetailPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-4 w-16 rounded bg-[var(--surface-active)]" />
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="w-full flex-shrink-0 md:w-60">
          <div className="aspect-[2/3] rounded-2xl bg-[var(--surface-active)]" />
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="h-9 w-2/3 rounded bg-[var(--surface-active)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-active)]" />
          <div className="space-y-2.5 pt-2">
            <div className="h-3.5 w-full rounded bg-[var(--surface-active)]" />
            <div className="h-3.5 w-full rounded bg-[var(--surface-active)]" />
            <div className="h-3.5 w-5/6 rounded bg-[var(--surface-active)]" />
            <div className="h-3.5 w-3/4 rounded bg-[var(--surface-active)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
