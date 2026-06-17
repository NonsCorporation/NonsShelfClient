import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import Hint from '../components/Hint'
import ActivityCard from '../components/ActivityCard'
import ProgressModal from '../components/ProgressModal'
import FinishModal from '../components/FinishModal'
import { libraryService } from '../services/libraryService'
import { activityService } from '../services/activityService'
import type { Activity } from '../services/activityService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { usePreferences } from '../contexts/PreferencesContext'
import { useAuth } from '../contexts/AuthContext'
import { statusLabel, STATUS_COLOR } from '../lib/shelf'
import { mediaPath } from '../lib/paths'
import { IoStar, IoEyeOffOutline, IoPeopleOutline, IoTrendingUpOutline } from 'react-icons/io5'

export default function FeedPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { showInProgress, setShowInProgress } = usePreferences()
  const [items, setItems] = useState<MediaItem[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  // Progress modal (books/series) and the ending modal (all types).
  const [progressItem, setProgressItem] = useState<MediaItem | null>(null)
  const [finishItem, setFinishItem] = useState<MediaItem | null>(null)

  const load = useCallback(() => {
    if (!user) return
    const me = { id: user.id, name: user.name || user.username, handle: user.username, uuid: user.uuid }
    Promise.all([libraryService.getItems(), activityService.getFriendsActivity(me)]).then(([lib, act]) => {
      setItems(lib)
      setActivity(act)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // The "edit progress" icon: movies jump straight to the ending modal (nothing
  // partial to track); books/series open the progress modal first.
  const editProgress = (it: MediaItem) => {
    if (it.type === 'movie') setFinishItem(it)
    else setProgressItem(it)
  }

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
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8">
            {inProgress.map((it) => (
              <div key={it.id} className="relative w-72 flex-shrink-0">
                <Link
                  to={mediaPath(it)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 transition-colors hover:border-[var(--border)]"
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
                  <div className="min-w-0 flex-1 pr-7">
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
                <button
                  onClick={() => editProgress(it)}
                  title={t('updateProgress') || 'Update progress'}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-nonsprimary"
                >
                  <IoTrendingUpOutline className="h-4 w-4" />
                </button>
              </div>
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
          <div className="animate-fade-up flex flex-col gap-4">
            {activity.map((a) => (
              <ActivityCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      <ProgressModal
        isOpen={!!progressItem}
        item={progressItem}
        onClose={() => setProgressItem(null)}
        onFinish={() => {
          setFinishItem(progressItem)
          setProgressItem(null)
        }}
      />
      <FinishModal
        isOpen={!!finishItem}
        item={finishItem}
        onClose={() => setFinishItem(null)}
        onFinished={() => {
          setFinishItem(null)
          load()
        }}
      />
    </Layout>
  )
}
