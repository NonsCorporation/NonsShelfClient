import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Hint from '../components/Hint'
import { libraryService } from '../services/libraryService'
import { activityService } from '../services/activityService'
import type { Activity, ActivityType } from '../services/activityService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { useAuth } from '../contexts/AuthContext'
import { statusLabel, STATUS_COLOR } from '../lib/shelf'
import { initials } from '../lib/user'
import { mediaPath, userPath } from '../lib/paths'
import { IoStar, IoEyeOffOutline, IoBookOutline, IoFilmOutline, IoTvOutline, IoPeopleOutline } from 'react-icons/io5'

const VERB_KEY: Record<ActivityType, string> = {
  rated: 'verbRated',
  finished: 'verbFinished',
  started: 'verbStarted',
  added: 'verbAdded',
  reviewed: 'verbReviewed',
}

function ActivityRow({ a }: { a: Activity }) {
  const { t } = useLanguage()
  const TypeIcon = a.mediaType === 'book' ? IoBookOutline : a.mediaType === 'series' ? IoTvOutline : IoFilmOutline
  return (
    <div className="flex items-start gap-3 border-b border-[var(--divider)] py-4 last:border-0">
      <Link
        to={userPath(a.user.handle || a.user.uuid || '')}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: a.user.color }}
        title={a.user.name}
      >
        {initials(a.user.name)}
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--text)]">
          <Link to={userPath(a.user.handle || a.user.uuid || '')} className="font-semibold hover:underline">
            {a.user.name}
          </Link>{' '}
          <span className="text-[var(--text-muted)]">{t(VERB_KEY[a.type])}</span>{' '}
          <span className="font-medium">{a.mediaTitle}</span>
        </p>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <TypeIcon className="h-3.5 w-3.5" />
            {a.mediaType === 'book' ? t('book') : a.mediaType === 'series' ? t('series') : t('film')}
          </span>
          {typeof a.rating === 'number' && (
            <span className="inline-flex items-center gap-1 font-medium text-[var(--text)]">
              <IoStar className="h-3 w-3 text-nonsprimaryfocus" />
              {a.rating.toFixed(1)}
            </span>
          )}
          <span>·</span>
          <span>{a.timeAgo}</span>
        </div>

        {a.text && <p className="mt-1.5 text-sm italic leading-6 text-[var(--text-muted)]">“{a.text}”</p>}
      </div>

      {a.coverUrl && (
        <img
          src={a.coverUrl}
          alt={a.mediaTitle}
          loading="lazy"
          className="h-16 w-11 flex-shrink-0 rounded-md border border-[var(--border-subtle)] object-cover"
        />
      )}
    </div>
  )
}

export default function FeedPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { showInProgress, setShowInProgress } = usePreferences()
  const [items, setItems] = useState<MediaItem[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([libraryService.getItems(), activityService.getFriendsActivity(user.id)]).then(([lib, act]) => {
      setItems(lib)
      setActivity(act)
      setLoading(false)
    })
  }, [user])

  const inProgress = useMemo(() => items.filter((it) => it.status === 'active'), [items])

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('home')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('feedSubtitle')}</p>
      </div>

      {/* Currently watching / reading */}
      {!loading && inProgress.length > 0 && showInProgress && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR.active }} />
              {t('shelfActive')}
            </h2>
            <p className="hidden text-sm text-[var(--text-muted)] sm:block">{t('continueHint')}</p>
            <button
              onClick={() => setShowInProgress(false)}
              title={t('hide')}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              <IoEyeOffOutline className="h-4 w-4" />
              {t('hide')}
            </button>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {inProgress.map((it) => (
              <Link
                key={it.id}
                to={mediaPath(it)}
                className="group flex w-72 flex-shrink-0 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-[var(--border)]"
              >
                {it.coverUrl ? (
                  <img
                    src={it.coverUrl}
                    alt={it.title}
                    loading="lazy"
                    className="h-[84px] w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-[84px] w-14 flex-shrink-0 rounded-lg bg-[var(--container-2)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium" style={{ color: STATUS_COLOR.active }}>
                    {statusLabel(it.type, 'active', t)}
                  </p>
                  <h3 className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">{it.title}</h3>
                  <p className="truncate text-xs text-[var(--text-muted)]">{it.author}</p>
                  {typeof it.rating === 'number' && it.rating > 0 && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--text)]">
                      <IoStar className="h-3 w-3 text-nonsprimary" />
                      {(it.rating / 2).toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && inProgress.length > 0 && !showInProgress && (
        <Hint icon={IoEyeOffOutline} className="mb-10">
          {t('inProgressHiddenHint')}
        </Hint>
      )}

      {/* Friends activity */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{t('friendsActivity')}</h2>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]">
              <IoPeopleOutline className="h-7 w-7 text-[var(--text-muted)]" />
            </div>
            <p className="max-w-sm px-6 text-sm leading-6 text-[var(--text-muted)]">{t('inviteFriends')}</p>
          </div>
        ) : (
          <div className="animate-fade-up rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] px-4">
            {activity.map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  )
}
