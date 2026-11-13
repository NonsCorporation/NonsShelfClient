'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { IoRibbonOutline } from 'react-icons/io5'
import Layout from '@/components/layout/Layout'
import ListCard from '@/components/discover/ListCard'
import OfficialBadge from '@/components/official/OfficialBadge'
import { BoardPreview } from '@/components/bingo/BingoGrid'
import { KindTag } from '@/components/bingo/BingoParts'
import { Link } from '@/lib/router'
import { bingoPath, doneCount, progressMask, useBingos, type Bingo } from '@/lib/bingo'
import { challengeTitle, goalLabel, isGoalChallenge } from '@/lib/challenge'
import { challengeService } from '@/services/challengeService'
import { bingoApi } from '@/services/bingoService'
import { listService } from '@/services/listService'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Challenge, CuratedListDiscoverEntry } from '@/types'

// /official — everything SomeShelf itself curates, in one place: official
// challenges, bingos and lists. Official items carry no author, so nothing here
// names (or links to) whoever happened to publish them.
export default function Official() {
  const { t } = useLanguage()
  const [challenges, setChallenges] = useState<Challenge[] | null>(null)
  const [boards, setBoards] = useState<Bingo[] | null>(null)
  const [lists, setLists] = useState<CuratedListDiscoverEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    challengeService
      .listChallenges()
      .then((all) => alive && setChallenges(all.filter((c) => c.official).sort((a, b) => Number(isGoalChallenge(b)) - Number(isGoalChallenge(a)))))
      .catch(() => alive && setChallenges([]))
    bingoApi
      .official()
      .then((b) => alive && setBoards(b))
      .catch(() => alive && setBoards([]))
    listService
      .officialLists()
      .then((l) => alive && setLists(l))
      .catch(() => alive && setLists([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--text)]">
            <IoRibbonOutline className="h-5 w-5 text-nonsprimary" />
            {t('officialTitle')}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('officialSubtitle')}</p>
        </header>

        <Section title={t('officialChallenges')} items={challenges} empty={t('officialEmpty')}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{challenges?.map((c) => <ChallengeTile key={c.id} challenge={c} />)}</div>
        </Section>

        <Section title={t('officialBingos')} items={boards} empty={t('officialEmpty')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{boards?.map((b) => <BingoTile key={b.id} board={b} />)}</div>
        </Section>

        <Section title={t('officialLists')} items={lists} empty={t('officialEmpty')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{lists?.map((l) => <ListCard key={l.id} list={l} />)}</div>
        </Section>
      </div>
    </Layout>
  )
}

function Section({ title, items, empty, children }: { title: string; items: unknown[] | null; empty: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h2>
      {items === null ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-nonsprimary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--text-muted)]">{empty}</p>
      ) : (
        children
      )}
    </section>
  )
}

function ChallengeTile({ challenge }: { challenge: Challenge }) {
  const { t } = useLanguage()
  const hasProgress = challenge.joined && (challenge.target ?? 0) > 0
  const pct = hasProgress ? Math.min(100, Math.round(((challenge.progress ?? 0) / challenge.target!) * 100)) : 0
  return (
    <Link
      to={`/challenge/${challenge.uuid}`}
      className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-base font-semibold text-[var(--text)]">{challengeTitle(t, challenge)}</p>
        <OfficialBadge className="flex-shrink-0" />
      </div>
      {challenge.description && <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{challenge.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        {!isGoalChallenge(challenge) && (
          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5">
            {t('goal')}: {goalLabel(t, challenge)}
          </span>
        )}
        <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5">{t('nParticipants', { n: challenge.participants })}</span>
      </div>
      {hasProgress && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              {challenge.progress ?? 0} / {challenge.target}
            </span>
            <span className="font-semibold text-nonsprimary">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--container-2)]">
            <div className="h-full rounded-full bg-nonsprimary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Link>
  )
}

function BingoTile({ board }: { board: Bingo }) {
  const { t } = useLanguage()
  const { runs } = useBingos()
  // The viewer's own latest play-through, when it was played on this exact version of the board.
  const run = runs[board.id]?.at(-1)
  const current = run && run.revision === board.revision ? run : undefined
  const mask = progressMask(board, current?.marks, current?.answers)
  const done = doneCount(mask)
  const total = board.rows * board.cols
  return (
    <Link
      to={bingoPath(board.id)}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 text-left transition-transform hover:-translate-y-1"
    >
      <BoardPreview rows={board.rows} cols={board.cols} cells={board.cells} freeCenter={board.freeCenter} kind={board.kind} mask={mask} answers={current?.answers} />
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <KindTag kind={board.kind} />
          <OfficialBadge />
        </div>
        <p className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{board.title}</p>
        {current && (
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {board.kind === 'prompt' ? t('bingoFilledCount', { count: done, total }) : t('bingoProgress', { count: done, total })}
          </p>
        )}
      </div>
    </Link>
  )
}
