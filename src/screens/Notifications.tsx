'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@/lib/router'
import Layout from '../components/layout/Layout'
import BoringAvatar from '@/components/ui/BoringAvatar'
import { useNotifications } from '../contexts/NotificationContext'
import {
  getNotifications,
  markAllRead,
  type LibNotification,
  type NotificationType,
} from '../services/notificationService'
import { NONS_LOGIN_URL } from '../lib/api'
import {
  IoChatbubbleOutline,
  IoReturnDownForwardOutline,
  IoChevronUp,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoNotificationsOutline,
} from 'react-icons/io5'
import { userPath } from '../lib/paths'

function secsAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`
  return `${Math.floor(s / (7 * 86400))}w ago`
}

const VERB: Record<string, string> = {
  shelved:  'shelved',
  started:  'started reading',
  finished: 'finished',
  rated:    'rated',
  reviewed: 'reviewed',
  progress: 'updated progress on',
  dnf:      'did not finish',
}

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  comment:              IoChatbubbleOutline,
  reply:                IoReturnDownForwardOutline,
  like:                 IoChevronUp,
  suggestion_approved:  IoCheckmarkCircleOutline,
  suggestion_rejected:  IoCloseCircleOutline,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  comment:              'text-blue-400',
  reply:                'text-violet-400',
  like:                 'text-nonsprimary',
  suggestion_approved:  'text-emerald-400',
  suggestion_rejected:  'text-red-400',
}

function ActorAvatar({ actor }: { actor: LibNotification['actor'] }) {
  const size = 36
  if (!actor) return <span className="h-9 w-9 flex-shrink-0 rounded-full bg-[var(--surface)]" />
  return actor.avatar_url ? (
    <img
      src={actor.avatar_url}
      alt={actor.name}
      className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="flex-shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      <BoringAvatar size={size} name={`user-${actor.id}`} />
    </span>
  )
}

function NotificationCard({ n, onNavigate }: { n: LibNotification; onNavigate: (n: LibNotification) => void }) {
  const Icon = TYPE_ICON[n.type]
  const color = TYPE_COLOR[n.type]
  const unread = n.read_at == null
  const isSuggestion = n.type === 'suggestion_approved' || n.type === 'suggestion_rejected'

  const actorName = n.actor?.name || n.actor?.username || 'Someone'
  const actorHandle = n.actor?.username

  // Build the label sentence
  let label: string
  if (n.type === 'comment') {
    label = `commented on your ${VERB[n.post?.kind ?? ''] ?? 'activity'}`
  } else if (n.type === 'reply') {
    label = 'replied to your comment'
  } else if (n.type === 'like') {
    label = `liked your ${VERB[n.post?.kind ?? ''] ?? 'activity'}`
  } else if (n.type === 'suggestion_approved') {
    label = 'Your catalog edit was approved'
  } else {
    label = 'Your catalog edit was rejected'
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-4 transition-colors cursor-pointer hover:bg-[var(--surface)] ${unread ? 'bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]' : ''}`}
      onClick={() => onNavigate(n)}
    >
      {/* Left: actor avatar with type badge */}
      <div className="relative flex-shrink-0">
        {isSuggestion ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] ${color}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : (
          <>
            <ActorAvatar actor={n.actor} />
            <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--container)] ${color}`}>
              <Icon className="h-2.5 w-2.5" />
            </span>
          </>
        )}
      </div>

      {/* Center: text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--text)]">
          {!isSuggestion && actorHandle ? (
            <Link
              to={userPath(actorHandle)}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {actorName}
            </Link>
          ) : null}
          {!isSuggestion && ' '}
          <span className={unread ? 'font-medium' : 'text-[var(--text-muted)]'}>{label}</span>
          {n.post?.media_title && (
            <>
              {' '}
              <span className="font-medium text-[var(--text)]">{n.post.media_title}</span>
            </>
          )}
        </p>

        {/* Comment snippet */}
        {n.comment?.body && (
          <p className="mt-1 line-clamp-2 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]">
            {n.comment.body}
          </p>
        )}

        <p className="mt-1 text-xs text-[var(--text-muted)]">{secsAgo(n.created_at)}</p>
      </div>

      {/* Right: unread dot */}
      {unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-nonsprimary" />}
    </div>
  )
}

export default function Notifications() {
  const navigate = useNavigate()
  const { refresh, nonsUnreadCount } = useNotifications()
  const [items, setItems] = useState<LibNotification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotifications(30, 0).then(({ items, total }) => {
      setItems(items)
      setTotal(total)
      setLoading(false)
    })
    markAllRead().then(refresh).catch(() => {})
  }, [refresh])

  const handleNavigate = (n: LibNotification) => {
    if (n.post_id) {
      navigate({ pathname: '/', search: `?post=${n.post_id}` })
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text)]">Notifications</h1>
          {total > 0 && (
            <span className="text-sm text-[var(--text-muted)]">{total}</span>
          )}
        </div>

        {/* Nons social app notifications */}
        <a
          href={`${NONS_LOGIN_URL}/notifications`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] px-4 py-3.5 transition-colors hover:bg-[var(--surface)]"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
            <IoNotificationsOutline className="h-5 w-5 text-[var(--text-muted)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text)]">Nons</p>
            <p className="text-xs text-[var(--text-muted)]">
              {nonsUnreadCount > 0
                ? `${nonsUnreadCount} unread notification${nonsUnreadCount === 1 ? '' : 's'}`
                : 'No new notifications'}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {nonsUnreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-nonsprimary px-1.5 text-[10px] font-bold text-white">
                {nonsUnreadCount > 99 ? '99+' : nonsUnreadCount}
              </span>
            )}
            <span>↗</span>
          </span>
        </a>

        {/* Library notifications section label */}
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Shelf
        </p>

        {loading && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-subtle)] last:border-0">
                <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-[var(--surface)]" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-[var(--surface)]" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-[var(--text-muted)]">
            <IoNotificationsOutline className="h-10 w-10 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
            {items.map((n) => (
              <NotificationCard key={n.id} n={n} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
