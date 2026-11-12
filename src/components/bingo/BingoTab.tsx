'use client'

import { useState } from 'react'
import { IoAdd, IoGridOutline } from 'react-icons/io5'
import { BoardPreview } from './BingoGrid'
import BingoEditor from './BingoEditor'
import { KindTag, SectionTitle } from './BingoParts'
import { Link, useNavigate } from '@/lib/router'
import {
  COMMUNITY_BINGOS,
  bingoPath,
  boardAtRevision,
  completedLines,
  doneCount,
  progressMask,
  useBingos,
  type Bingo,
  type BingoKind,
  type BingoRevision,
  type BingoRun,
} from '@/lib/bingo'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useLoginModal } from '@/contexts/LoginModalContext'

type Filter = 'all' | BingoKind

// Discover → Bingo tab: the list of boards and the "new bingo" flow. A board
// itself lives at /bingo/<uuid> (screens/BingoPage.tsx). Mock only: boards are
// kept in this browser's localStorage.
export default function BingoTab() {
  const { t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { openLogin } = useLoginModal()
  const navigate = useNavigate()
  const { mine, runs, revisions, save } = useBingos()

  const me = user?.name || user?.username || t('bingoYou')
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)

  const startNew = () => (isAuthenticated ? setCreating(true) : openLogin())
  const visible = (list: Bingo[]) => list.filter((b) => filter === 'all' || b.kind === filter)
  const myBoards = visible(mine)
  const communityBoards = visible(COMMUNITY_BINGOS)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-[var(--text-muted)]">{t('bingoSubtitle')}</p>
        <button
          onClick={startNew}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
        >
          <IoAdd className="h-4 w-4" />
          {t('bingoNew')}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            { key: 'all', label: t('all') },
            { key: 'list', label: t('bingoKindList') },
            { key: 'prompt', label: t('bingoKindPrompt') },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SectionTitle>{t('bingoYours')}</SectionTitle>
      {myBoards.length === 0 ? (
        <div className="mb-8 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)]">
            <IoGridOutline className="h-6 w-6 text-[var(--text-muted)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text)]">{t('bingoNoneYet')}</p>
          <p className="text-xs text-[var(--text-muted)]">{t('bingoNoneHint')}</p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {myBoards.map((b) => (
            <BingoCard key={b.id} board={b} runs={runs[b.id]} revisions={revisions[b.id]} mine />
          ))}
        </div>
      )}

      <SectionTitle>{t('bingoCommunity')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {communityBoards.map((b) => (
          <BingoCard key={b.id} board={b} runs={runs[b.id]} revisions={revisions[b.id]} />
        ))}
      </div>

      {!isAuthenticated && <p className="mt-8 text-xs text-[var(--text-muted)]">{t('bingoMockNote')}</p>}

      {creating && (
        <BingoEditor
          author={me}
          onClose={() => setCreating(false)}
          onSave={(b) => {
            save(b)
            setCreating(false)
            navigate(bingoPath(b.id))
          }}
        />
      )}
    </div>
  )
}

function BingoCard({ board: latest, runs, revisions, mine }: { board: Bingo; runs?: BingoRun[]; revisions?: BingoRevision[]; mine?: boolean }) {
  const { t } = useLanguage()
  const prompt = latest.kind === 'prompt'
  // The card shows the most recent run.
  const run = runs?.[runs.length - 1]
  // ...as that run saw the board, so ticks line up with the squares even after an edit.
  const board = run ? boardAtRevision(latest, revisions, run.revision) : latest
  const mask = progressMask(board, run?.marks, run?.answers)
  const done = doneCount(mask)
  const lines = completedLines(mask, board.rows, board.cols).length
  const total = board.rows * board.cols
  return (
    <Link
      to={bingoPath(latest.id)}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 text-left transition-transform hover:-translate-y-1"
    >
      <BoardPreview
        rows={board.rows}
        cols={board.cols}
        cells={board.cells}
        freeCenter={board.freeCenter}
        kind={board.kind}
        mask={mask}
        answers={run?.answers}
      />
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <KindTag kind={board.kind} />
          <span className="rounded-full bg-[var(--surface)] px-1.5 py-px text-[10px] font-medium text-[var(--text-muted)]">
            {board.rows}×{board.cols}
          </span>
          {mine && <span className="rounded-full bg-[var(--primary-soft)] px-1.5 py-px text-[10px] font-semibold text-nonsprimary">{t('bingoYoursTag')}</span>}
        </div>
        <p className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{latest.title}</p>
        {!mine && <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{t('bingoBy', { name: board.author })}</p>}
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          {prompt ? t('bingoFilledCount', { count: done, total }) : t('bingoProgress', { count: done, total })}
          {lines > 0 && <span className="ml-1.5 font-semibold text-nonspremium">· {t('bingoLines', { count: lines })}</span>}
          {runs && runs.length > 1 && <span className="ml-1.5">· {t('bingoRunsCount', { n: runs.length })}</span>}
        </p>
      </div>
    </Link>
  )
}
