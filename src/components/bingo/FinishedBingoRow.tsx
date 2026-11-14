import { Link } from '@/lib/router'
import { BoardPreview } from '@/components/bingo/BingoGrid'
import { bingoPath, emptyCells } from '@/lib/bingo'
import { shortTimeAgo, type BingoFeedRun } from '@/services/activityService'
import { useLanguage } from '@/contexts/LanguageContext'

// One finished bingo, compact: mini board, title and a line of stats. Links to
// that player's run. `player` is the owner's uuid or username.
export default function FinishedBingoRow({ run, player }: { run: BingoFeedRun; player: string }) {
  const { t } = useLanguage()
  return (
    <Link to={player ? bingoPath(run.boardId, player, run.runId) : bingoPath(run.boardId)} title={run.title} className="group flex items-center gap-3">
      <span className="w-16 flex-shrink-0 overflow-hidden rounded-lg">
        <BoardPreview
          rows={run.rows}
          cols={run.cols}
          cells={run.cells ?? emptyCells(run.rows, run.cols)}
          freeCenter={run.freeCenter}
          kind={run.kind}
          mask={run.mask}
          answers={run.answers}
        />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-[var(--text)] group-hover:text-nonsprimary">{run.title}</span>
        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
          {run.rows}×{run.cols} · {t('bingoLinesMany', { count: run.lines })}
          {run.finishedAt ? ` · ${shortTimeAgo(run.finishedAt)}` : ''}
        </span>
      </span>
    </Link>
  )
}
