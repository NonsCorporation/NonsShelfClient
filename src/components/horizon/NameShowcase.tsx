'use client'

import HorizonBadge from '@/components/badges/HorizonBadge'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

// One name as it appears in a post: photo, name and — for Horizon members — the
// Horizon icon beside it.
function NameRow({ avatar, name, horizon }: { avatar: React.ReactNode; name: string; horizon: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: 36, height: 36 }}>
        {avatar}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
        <span className="truncate">{name}</span>
        {horizon && <HorizonBadge className="h-4 w-4" />}
      </span>
    </div>
  )
}

// The /horizon section on the icon next to your name: the same name with and
// without it (Charlie Chaplin, a made-up member), and — when signed in — yours.
export default function NameShowcase() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const chaplin = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/horizon/chaplin.jpg" alt="" className="h-full w-full object-cover" />
  )
  const mine = user?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
  ) : (
    <BoringAvatar size={36} name={`user-${user?.id ?? 0}`} />
  )

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-[var(--text)]">{t('horizonNameTitle')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{t('horizonNameDesc')}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('horizonNameWithout')}</p>
          <NameRow avatar={chaplin} name="Charlie Chaplin" horizon={false} />
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('horizonNameWith')}</p>
          <NameRow avatar={chaplin} name="Charlie Chaplin" horizon />
        </div>
        {user && (
          <div className="rounded-2xl border border-nonsprimary/40 bg-[var(--primary-soft)] p-4 sm:col-span-2">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('horizonNameYours')}</p>
            <NameRow avatar={mine} name={user.name || user.username} horizon />
          </div>
        )}
      </div>
    </section>
  )
}
