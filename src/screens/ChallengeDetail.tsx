'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from '@/lib/router'
import { IoLockClosedOutline, IoPencilOutline, IoRibbonOutline, IoTrophyOutline } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import ChallengeAvatarStack from '@/components/challenges/ChallengeAvatarStack'
import CreateChallengeModal from '@/components/challenges/CreateChallengeModal'
import { challengeService } from '../services/challengeService'
import { getFriendUsers, type Activity } from '../services/activityService'
import { typeWord, goalLabel, conditionText, challengeTitle, isGoalChallenge } from '../lib/challenge'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useLoginModal } from '../contexts/LoginModalContext'
import type { Challenge } from '../types'

// A unix-seconds timestamp → a short localized date, or '' if unset.
function shortDate(unix?: number): string {
  if (!unix) return ''
  const d = new Date(unix * 1000)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// The /challenge/<uuid> detail page — the same information as a Discover
// ChallengeCard, laid out full-page: description in full (not clamped), every
// condition, the date window, and the join/leave action.
export default function ChallengeDetailScreen() {
  const { t } = useLanguage()
  const { user: authUser, isAuthenticated } = useAuth()
  const { openLogin } = useLoginModal()
  const { uuid = '' } = useParams<{ uuid: string }>()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  // For a goal challenge (the yearly reading challenge), the number the viewer
  // is entering as their personal target. Empty unless the input is open.
  const [goalInput, setGoalInput] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)
  // Friends map (nons user id -> display info), for prioritizing "you" and
  // your friends in the avatar stack — same source Discover's cards use.
  const [friendMap, setFriendMap] = useState<Map<number, Activity['user']>>(new Map())

  const load = useCallback(() => {
    return challengeService.getChallenge(uuid).then((c) => {
      setChallenge(c)
      setNotFound(!c)
      setLoading(false)
    })
  }, [uuid])

  useEffect(() => { setLoading(true); load() }, [load])

  useEffect(() => {
    if (!authUser) return
    let cancelled = false
    getFriendUsers({
      id: authUser.id, name: authUser.name || authUser.username, handle: authUser.username,
      uuid: authUser.uuid, avatar: authUser.avatar_url, role: authUser.role,
    }).then((m) => { if (!cancelled) setFriendMap(m) })
    return () => { cancelled = true }
  }, [authUser])

  const toggleJoin = async () => {
    if (!challenge) return
    if (!isAuthenticated) {
      openLogin('challenge')
      return
    }
    setBusy(true)
    try {
      if (challenge.joined) {
        await challengeService.leaveChallenge(challenge.id)
        setChallenge((c) => (c ? { ...c, joined: false, progress: undefined, target: undefined, completed_at: undefined } : c))
      } else {
        const updated = await challengeService.joinChallenge(challenge.id)
        setChallenge(updated)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveGoal = async () => {
    if (!challenge) return
    if (!isAuthenticated) {
      openLogin('challenge')
      return
    }
    const n = Number(goalInput)
    if (!n || n <= 0) return
    setBusy(true)
    try {
      const updated = await challengeService.setChallengeGoal(challenge.id, n)
      setChallenge(updated)
      setEditingGoal(false)
      setGoalInput('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div></Layout>
  }
  if (notFound || !challenge) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound')}</div></Layout>
  }

  const isOwner = !!authUser && authUser.id === challenge.created_by
  const goal = isGoalChallenge(challenge)
  const hasProgress = challenge.joined && typeof challenge.target === 'number' && challenge.target > 0
  const pct = hasProgress ? Math.min(100, Math.round(((challenge.progress ?? 0) / challenge.target!) * 100)) : 0
  const completed = challenge.joined && (challenge.completed_at ?? 0) > 0
  const startLabel = shortDate(challenge.start_date)
  const endLabel = shortDate(challenge.end_date)

  return (
    <Layout>
      {/* Header — matches the app's standard card treatment (Profile.tsx, ListDetail.tsx). */}
      <div className="mb-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-5 sm:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-nonsprimary">
          <IoTrophyOutline className="h-3 w-3" />
          {t('challenges')}
        </span>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{challengeTitle(t, challenge)}</h1>
            {challenge.creator_name && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">{t('byCreator', { name: challenge.creator_name })}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {challenge.official && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-nonsprimary">
                <IoRibbonOutline className="h-3.5 w-3.5" />
                {t('challengeOfficialBadge')}
              </span>
            )}
            {challenge.private && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                <IoLockClosedOutline className="h-3.5 w-3.5" />
                {t('challengePrivateBadge')}
              </span>
            )}
            {completed && (
              <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#3ec98a22', color: '#3ec98a' }}>
                {t('challengeCompleted')}
              </span>
            )}
            {isOwner && (
              <button
                onClick={() => setEditing(true)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={t('editChallenge')}
                title={t('editChallenge')}
              >
                <IoPencilOutline className="h-4 w-4" />
              </button>
            )}
            {/* A private ("personal only") challenge can only be joined by its
                creator, who is auto-joined at creation — so no join action is
                offered to anyone else. Goal challenges use the goal panel below
                instead of a join button. */}
            {!goal && (!challenge.private || isOwner) && (
              <button
                onClick={toggleJoin}
                disabled={busy}
                className={`h-10 rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  challenge.joined
                    ? 'border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                }`}
              >
                {challenge.joined ? t('leaveChallenge') : t('joinChallenge')}
              </button>
            )}
          </div>
        </div>

        {challenge.description && (
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--text-muted)]">{challenge.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {challenge.media_type && (
            <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1">{typeWord(t, challenge.media_type)}</span>
          )}
          {!goal && (
            <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1">{t('goal')}: {goalLabel(t, challenge)}</span>
          )}
          {(startLabel || endLabel) && (
            <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1">
              {startLabel || '…'} – {endLabel || '…'}
            </span>
          )}
          <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1">{t('nParticipants', { n: challenge.participants })}</span>
        </div>

        <div className="mt-3">
          <ChallengeAvatarStack
            challenge={challenge}
            viewer={authUser ? { id: authUser.id, name: authUser.name || authUser.username, avatarUrl: authUser.avatar_url } : null}
            friendMap={friendMap}
            size={28}
          />
        </div>

        {challenge.conditions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            {challenge.conditions.map((cond, i) => {
              const text = conditionText(t, cond)
              const chipCls = 'rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1'
              return cond.href ? (
                <Link key={i} to={cond.href} className={`${chipCls} text-nonsprimary hover:underline`}>
                  {text}
                </Link>
              ) : (
                <span key={i} className={`${chipCls} text-[var(--text-muted)]`}>{text}</span>
              )
            })}
          </div>
        )}

        {goal ? (
          <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <IoRibbonOutline className="h-4 w-4 text-nonsprimary" />
              <span className="text-sm font-semibold text-[var(--text)]">{t('yourGoal')}</span>
            </div>
            {hasProgress && !editingGoal ? (
              <>
                <div className="mb-1.5 flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span>{t('readingGoalProgress', { progress: challenge.progress ?? 0, target: challenge.target ?? 0 })}</span>
                  <span className="font-semibold text-nonsprimary">{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
                  <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => { setEditingGoal(true); setGoalInput(String(challenge.target ?? '')) }}
                    className="text-sm font-medium text-nonsprimary hover:underline"
                  >
                    {t('changeGoal')}
                  </button>
                  <button
                    onClick={toggleJoin}
                    disabled={busy}
                    className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
                  >
                    {t('leaveChallenge')}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="30"
                  className="h-10 w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                />
                <span className="text-sm text-[var(--text-muted)]">{t('books')}</span>
                <button
                  onClick={saveGoal}
                  disabled={busy || !goalInput}
                  className="ml-auto h-10 rounded-lg bg-nonsprimary px-5 text-sm font-medium text-white hover:bg-nonsprimaryfocus disabled:opacity-50"
                >
                  {t('setGoal')}
                </button>
              </div>
            )}
          </div>
        ) : hasProgress ? (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm text-[var(--text-muted)]">
              <span>{challenge.progress ?? 0} / {challenge.target}</span>
              <span className="font-semibold text-nonsprimary">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
              <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {isOwner && (
        <CreateChallengeModal
          isOpen={editing}
          onClose={() => setEditing(false)}
          challenge={challenge}
          onSaved={(c) => setChallenge(c)}
        />
      )}
    </Layout>
  )
}
