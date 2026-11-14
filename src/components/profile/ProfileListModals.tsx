'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PagedModal from './PagedModal'
import FinishedBingoRow from '@/components/bingo/FinishedBingoRow'
import ChallengeShield from '@/components/challenges/ChallengeShield'
import { getUserFinishedBingos, type BingoFeedRun } from '@/services/activityService'
import { challengeService } from '@/services/challengeService'
import type { Challenge } from '@/types'
import { useLanguage } from '@/contexts/LanguageContext'

const PAGE = 12

// Fetches a list one page at a time: the first page on mount, then one more per
// call to `more`. `fetchPage(offset)` returns the page and the full total.
function usePaged<T>(fetchPage: (offset: number) => Promise<{ items: T[]; total: number }>, initialTotal: number) {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const fetchRef = useRef(fetchPage)
  useEffect(() => {
    fetchRef.current = fetchPage
  })

  const load = useCallback(async (offset: number) => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      const page = await fetchRef.current(offset)
      setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]))
      setTotal(page.total)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(0)
  }, [load])

  return { items, total, loading, hasMore: items.length < total, more: () => void load(items.length) }
}

/** Every finished bingo of a player, a page at a time. `user` is their uuid or username. */
export function FinishedBingosModal({ user, total, onClose }: { user: string; total: number; onClose: () => void }) {
  const { t } = useLanguage()
  const list = usePaged<BingoFeedRun>((offset) => getUserFinishedBingos(user, PAGE, offset), total)
  return (
    <PagedModal title={t('bingoFinishedTitle')} total={list.total} hasMore={list.hasMore} loading={list.loading} onLoadMore={list.more} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {list.items.map((r) => (
          <FinishedBingoRow key={`${r.boardId}/${r.runId}`} run={r} player={user} />
        ))}
      </div>
    </PagedModal>
  )
}

/** Every challenge a user has joined, a page at a time. */
export function ChallengesModal({ userId, total, onClose }: { userId: number; total: number; onClose: () => void }) {
  const { t } = useLanguage()
  const list = usePaged<Challenge>(
    (offset) => challengeService.listUserChallenges(userId, { limit: PAGE, offset }).then((r) => ({ items: r.challenges, total: r.total })),
    total,
  )
  return (
    <PagedModal title={t('challenges')} total={list.total} hasMore={list.hasMore} loading={list.loading} onLoadMore={list.more} onClose={onClose}>
      <div className="flex flex-wrap gap-4">
        {list.items.map((c) => (
          <ChallengeShield key={c.id} challenge={c} t={t} />
        ))}
      </div>
    </PagedModal>
  )
}
