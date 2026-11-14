'use client'

import { useEffect, useState } from 'react'
import {
  IoAdd,
  IoArrowBack,
  IoCheckmark,
  IoCheckmarkDoneOutline,
  IoCopyOutline,
  IoCreateOutline,
  IoLockOpenOutline,
  IoPeopleOutline,
  IoRefresh,
  IoShareSocialOutline,
  IoTrashOutline,
  IoTrophyOutline,
} from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import BingoGrid from '../components/bingo/BingoGrid'
import BingoEditor from '../components/bingo/BingoEditor'
import BingoAnswerModal from '../components/bingo/BingoAnswerModal'
import BingoShareModal from '../components/bingo/BingoShareModal'
import BingoShareSheet from '../components/bingo/BingoShareSheet'
import { KindTag, ProgressBar } from '../components/bingo/BingoParts'
import OfficialBadge from '@/components/official/OfficialBadge'
import ConfirmModal from '../components/ui/ConfirmModal'
import DropdownMenu, { type MenuItem } from '../components/ui/DropdownMenu'
import { Link, useLocation, useNavigate, useSearchParams } from '../lib/router'
import {
  bingoPath,
  boardAtRevision,
  bingoShareUrl,
  completedLines,
  decodeShare,
  doneCount,
  copyOfBingo,
  markServerBoard,
  progressMask,
  useBingos,
  type Bingo,
  type SharedRun,
} from '../lib/bingo'
import { bingoApi, type ServerPlayerRun } from '../services/bingoService'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useLoginModal } from '../contexts/LoginModalContext'

type Copied = 'board' | 'result' | 'saved' | null

// /bingo/<board uuid>                    the board, with your own runs
// /bingo/<board uuid>/<user uuid>        that user's latest run
// /bingo/<board uuid>/<user uuid>/<run>  one specific run (a finished result worth sharing)
// A board or result this browser doesn't have is loaded from the server; a link
// may also carry the board and result in its `d` parameter (works without it).
export default function BingoPage() {
  const { t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { openLogin } = useLoginModal()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const store = useBingos()

  const [, boardId, userSeg, runSeg] = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  const me = user?.uuid || user?.username || 'guest'
  const meName = user?.name || user?.username || t('bingoYou')

  const [editor, setEditor] = useState(false)
  const [confirm, setConfirm] = useState<'board' | 'run' | 'update' | null>(null)
  const [answering, setAnswering] = useState<number | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState<Copied>(null)

  // /bingo on its own has nothing to show.
  useEffect(() => {
    if (!boardId) navigate('/discover?tab=bingo', { replace: true })
  }, [boardId, navigate])

  const payload = params.get('d')
  const fromLink = payload && boardId ? decodeShare(payload, boardId) : null

  const own = store.mine.find((b) => b.id === boardId)

  // Ask the server for what this browser doesn't have: the board itself, and
  // someone else's result when the path names another player.
  const othersResult = !!userSeg && userSeg !== me
  const remote = useRemoteBingo(
    boardId,
    !!boardId && !own && !fromLink,
    othersResult && !fromLink?.run ? userSeg : undefined,
    runSeg,
  )
  // The link payload wins; otherwise the server's copy fills the same role.
  const decoded: { board: Bingo; run: SharedRun | null; by: string } | null =
    fromLink ?? (remote.result ? fromServerRun(remote.result) : remote.board ? { board: remote.board, run: null, by: '' } : null)

  const resolved: { board: Bingo; source: 'mine' | 'shared' } | null = own
    ? { board: own, source: 'mine' }
    : decoded
      ? { board: decoded.board, source: 'shared' }
      : null

  if (!boardId) return null

  const back = (
    <Link to="/discover?tab=bingo" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">
      <IoArrowBack className="h-4 w-4" />
      {t('bingoBack')}
    </Link>
  )

  if (!resolved && remote.loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl">
          {back}
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-nonsprimary border-t-transparent" />
          </div>
        </div>
      </Layout>
    )
  }

  if (!resolved) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl">
          {back}
          <p className="rounded-xl border border-nonslightred/40 bg-nonslightred/10 px-4 py-3 text-sm text-[var(--text)]">
            {payload ? t('bingoSharedInvalid') : t('bingoNotFound')}
          </p>
        </div>
      </Layout>
    )
  }

  const { board: latest, source } = resolved
  const ownRuns = store.runs[latest.id] ?? []

  // Whose result is on screen: somebody else's (read-only, from the link), or one of my runs.
  const viewingSelf = !userSeg || userSeg === me
  const myRun = viewingSelf && runSeg ? ownRuns.find((r) => r.id === runSeg) : undefined
  const theirs = !!decoded?.run && (!viewingSelf || (!!runSeg && !myRun))
  const unavailable = !theirs && !!userSeg && !viewingSelf && !remote.loading
  const activeRun = theirs ? undefined : myRun ?? (runSeg && viewingSelf ? undefined : ownRuns[ownRuns.length - 1])

  // What is on screen is the board as that run saw it: someone's shared result carries its own copy,
  // and one of my runs keeps the revision it was started on even after the board was edited.
  const board: Bingo = theirs && decoded ? decoded.board : activeRun ? boardAtRevision(latest, store.revisions[latest.id], activeRun.revision) : latest
  const prompt = board.kind === 'prompt'
  const outdated = !!activeRun && activeRun.revision < latest.revision
  const editedSince = theirs && !!decoded && JSON.stringify(decoded.board.cells) !== JSON.stringify(latest.cells) && source !== 'shared'

  const marks = theirs ? decoded?.run?.marks ?? undefined : activeRun?.marks
  const answers = theirs ? decoded?.run?.answers ?? null : activeRun?.answers ?? null
  const mask = progressMask(board, marks, answers ?? undefined)
  const lines = completedLines(mask, board.rows, board.cols)
  const winning = new Set(lines.flat())
  const done = doneCount(mask)
  const total = board.rows * board.cols
  const everything = done === total
  const centreOffset = board.freeCenter && board.rows % 2 === 1 && board.cols % 2 === 1 ? 1 : 0
  const hasProgress = done > centreOffset
  const locked = theirs || !!activeRun?.finishedAt

  // Title, description and author always come from the latest board: editing those never needs a new revision.
  const byline =
    latest.official ? '' : source === 'shared' && latest.author ? t('bingoSharedBy', { name: latest.author }) : latest.author ? t('bingoBy', { name: latest.author }) : ''

  // ── links ──
  const boardLink = () => bingoShareUrl(latest)
  const resultLink = () =>
    theirs
      ? bingoShareUrl(board, {
          userId: userSeg,
          runId: runSeg,
          run: decoded?.run ? { marks: decoded.run.marks ?? undefined, answers: decoded.run.answers ?? undefined } : undefined,
          by: decoded?.by,
        })
      : bingoShareUrl(board, { userId: me, runId: activeRun?.id, run: activeRun ? { marks: activeRun.marks, answers: activeRun.answers } : undefined, by: meName })
  const cardLink = () => (hasProgress && (theirs || activeRun) ? resultLink() : boardLink())

  const flash = (kind: Exclude<Copied, null>) => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }
  const copy = async (url: string, kind: 'board' | 'result') => {
    try {
      await navigator.clipboard.writeText(url)
      flash(kind)
    } catch {
      window.prompt(t('bingoShare'), url)
    }
  }

  const goRun = (id: string) => navigate(bingoPath(board.id, me, id))
  const newRun = () => goRun(store.startRun(latest))

  const saveCopy = () => {
    if (!isAuthenticated) return openLogin()
    const dupe = copyOfBingo(latest, meName)
    store.save(dupe)
    flash('saved')
    navigate(bingoPath(dupe.id))
  }

  // Content edits start a new revision; runs already played keep the one they were started on.
  const onSaveBoard = (b: Bingo) => {
    store.save(b)
    setEditor(false)
  }

  const onCell = locked
    ? undefined
    : (i: number) => {
        if (prompt) setAnswering(i)
        else store.toggle(board, activeRun?.id, i)
      }

  const shareable = hasProgress && (theirs || !!activeRun)

  // Everything that isn't the main thing to do lives in two small menus.
  const boardMenu: MenuItem[] =
    source === 'mine'
      ? [
          { label: t('bingoEdit'), icon: <IoCreateOutline className="h-4 w-4" />, onClick: () => setEditor(true) },
          { label: t('bingoDelete'), icon: <IoTrashOutline className="h-4 w-4" />, onClick: () => setConfirm('board'), danger: true, divider: true },
        ]
      : [{ label: t('bingoCopy'), icon: <IoCopyOutline className="h-4 w-4" />, onClick: saveCopy }]

  const runMenu: MenuItem[] = activeRun
    ? [
        ...(activeRun.finishedAt
          ? [{ label: t('bingoReopen'), icon: <IoLockOpenOutline className="h-4 w-4" />, onClick: () => store.reopenRun(board.id, activeRun.id) }]
          : hasProgress
            ? [
                { label: t('bingoFinishRun'), icon: <IoCheckmarkDoneOutline className="h-4 w-4" />, onClick: () => store.finishRun(board.id, activeRun.id) },
                { label: t('bingoStartOver'), icon: <IoRefresh className="h-4 w-4" />, onClick: () => store.resetRun(board.id, activeRun.id) },
              ]
            : []),
        { label: t('bingoDeleteRun'), icon: <IoTrashOutline className="h-4 w-4" />, onClick: () => setConfirm('run'), danger: true, divider: true },
      ]
    : []

  const linesLabel = lines.length === 1 ? t('bingoLineOne') : t('bingoLinesMany', { count: lines.length })

  return (
    <Layout>
      <div className="mx-auto max-w-2xl animate-fade-up">
        {back}

        {/* Header: what this is, and the one thing most people want to do with it */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindTag kind={board.kind} />
              {latest.official && <OfficialBadge />}
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                {board.rows}×{board.cols}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)]">{latest.title}</h1>
            {byline && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{byline}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={() => setSheet(true)}
              className="flex items-center gap-1.5 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              <IoShareSocialOutline className="h-4 w-4" />
              {t('share')}
            </button>
            <DropdownMenu items={boardMenu} buttonClassName="flex h-9 w-9 items-center justify-center" />
          </div>
        </div>
        {latest.description && <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{latest.description}</p>}

        <div className="mt-5 flex flex-col gap-3">
          {theirs && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--primary-ring)] bg-[var(--primary-soft)] px-4 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <IoPeopleOutline className="mt-0.5 h-5 w-5 flex-shrink-0 text-nonsprimary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{t('bingoTheirResult', { name: decoded?.by || board.author || '?' })}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t('bingoTheirResultHint')}</p>
                </div>
              </div>
              <button
                onClick={() => navigate(bingoPath(board.id))}
                className="flex-shrink-0 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
              >
                {t('bingoPlayMine')}
              </button>
            </div>
          )}
          {outdated && activeRun && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-nonspremium/40 bg-nonspremium/10 px-4 py-3">
              <p className="min-w-0 text-sm text-[var(--text)]">{activeRun.finishedAt ? t('bingoOutdatedFinished') : t('bingoOutdatedRun')}</p>
              {!activeRun.finishedAt && (
                <button
                  onClick={() => setConfirm('update')}
                  className="flex-shrink-0 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
                >
                  {t('bingoUpdateRun')}
                </button>
              )}
            </div>
          )}
          {editedSince && <p className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{t('bingoEditedSince')}</p>}
          {unavailable && <p className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{t('bingoResultUnavailable')}</p>}

          {/* Runs: tabs for each play-through, a "+" for another one, and a small menu for the current one */}
          {!theirs && ownRuns.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-[var(--surface)] p-1">
                {ownRuns.map((r, i) => {
                  const active = activeRun?.id === r.id
                  return (
                    <button
                      key={r.id}
                      onClick={() => goRun(r.id)}
                      aria-pressed={active}
                      className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        active ? 'bg-[var(--container)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {r.finishedAt && <IoCheckmark className="h-3.5 w-3.5 text-nonsprimary" />}
                      {t('bingoRunN', { n: i + 1 })}
                    </button>
                  )
                })}
                <button
                  onClick={newRun}
                  aria-label={t('bingoNewRun')}
                  title={t('bingoNewRun')}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                >
                  <IoAdd className="h-4 w-4" />
                </button>
              </div>
              {runMenu.length > 0 && <DropdownMenu items={runMenu} buttonClassName="flex h-9 w-9 items-center justify-center" />}
            </div>
          )}

          {/* Progress */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="leading-none">
                  <span className="text-3xl font-bold tracking-tight text-[var(--text)]">{done}</span>
                  <span className="ml-1 text-sm text-[var(--text-muted)]">/ {total}</span>
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{prompt ? t('bingoFilledLabel') : t('bingoTickedLabel')}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {!theirs && activeRun?.finishedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-medium text-nonsprimary">
                    <IoCheckmark className="h-3.5 w-3.5" />
                    {t('bingoFinishedBanner')}
                  </span>
                )}
                {lines.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-nonspremium/15 px-2.5 py-1 text-xs font-semibold text-nonspremium">
                    <IoTrophyOutline className="h-3.5 w-3.5" />
                    {everything ? t('bingoAllDone') : linesLabel}
                  </span>
                )}
              </div>
            </div>
            <ProgressBar value={done} total={total} label={prompt ? t('bingoFilledLabel') : t('bingoTickedLabel')} />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 sm:p-4">
          <BingoGrid
            rows={board.rows}
            cols={board.cols}
            cells={board.cells}
            freeCenter={board.freeCenter}
            kind={board.kind}
            mask={mask}
            answers={answers}
            onCell={onCell}
          />
        </div>

        {/* One hint and, when it fits the moment, one button */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="min-w-0 flex-1 text-xs text-[var(--text-muted)]">
            {locked ? (theirs ? '' : t('bingoRunLocked')) : prompt ? t('bingoTapFillHint') : t('bingoTapHint')}
          </p>
          {!theirs && activeRun && !activeRun.finishedAt && hasProgress && (
            <button
              onClick={() => store.finishRun(board.id, activeRun.id)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
            >
              <IoCheckmarkDoneOutline className="h-4 w-4" />
              {t('bingoFinishRun')}
            </button>
          )}
          {!theirs && activeRun?.finishedAt && (
            <button
              onClick={newRun}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              <IoAdd className="h-4 w-4" />
              {t('bingoNewRun')}
            </button>
          )}
        </div>

        {!isAuthenticated && <p className="mt-8 text-xs text-[var(--text-muted)]">{t('bingoMockNote')}</p>}

        {sheet && (
          <BingoShareSheet
            hasResult={shareable}
            copied={copied === 'board' || copied === 'result' ? copied : null}
            onImage={() => {
              setSheet(false)
              setShowCard(true)
            }}
            onCopyBoard={() => copy(boardLink().url, 'board')}
            onCopyResult={() => copy(resultLink().url, 'result')}
            onClose={() => setSheet(false)}
          />
        )}
        {answering !== null && board.cells[answering] && (
          <BingoAnswerModal
            prompt={board.cells[answering]!.title}
            mediaType={board.mediaType}
            current={activeRun?.answers[answering] ?? null}
            onClose={() => setAnswering(null)}
            onAnswer={(cell) => {
              store.setAnswer(board, activeRun?.id, answering, cell)
              setAnswering(null)
            }}
          />
        )}
        {showCard && (
          <BingoShareModal
            board={board}
            mask={mask}
            answers={answers}
            winning={winning}
            link={cardLink().url}
            embedded={cardLink().embedded}
            onClose={() => setShowCard(false)}
          />
        )}
        {editor && <BingoEditor initial={latest} isEdit runsCount={ownRuns.length} author={meName} onClose={() => setEditor(false)} onSave={onSaveBoard} />}
        {confirm === 'board' && (
          <ConfirmModal
            title={t('bingoDeleteTitle')}
            message={t('bingoDeleteText')}
            confirmText={t('bingoDelete')}
            cancelText={t('cancel')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              store.remove(latest.id)
              setConfirm(null)
              navigate('/discover?tab=bingo', { replace: true })
            }}
          />
        )}
        {confirm === 'update' && activeRun && (
          <ConfirmModal
            title={t('bingoUpdateRunTitle')}
            message={t('bingoUpdateRunText')}
            confirmText={t('bingoUpdateRun')}
            cancelText={t('cancel')}
            variant="primary"
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              store.updateRun(latest, activeRun.id)
              setConfirm(null)
            }}
          />
        )}
        {confirm === 'run' && activeRun && (
          <ConfirmModal
            title={t('bingoDeleteRunTitle')}
            message={t('bingoDeleteRunText')}
            confirmText={t('bingoDeleteRun')}
            cancelText={t('cancel')}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              store.deleteRun(board.id, activeRun.id)
              setConfirm(null)
              navigate(bingoPath(board.id), { replace: true })
            }}
          />
        )}
      </div>
    </Layout>
  )
}

/** A server result in the shape the page already handles for `d` links. */
function fromServerRun(r: ServerPlayerRun): { board: Bingo; run: SharedRun; by: string } {
  const prompt = r.board.kind === 'prompt'
  return { board: r.board, run: { marks: prompt ? null : r.run.marks, answers: prompt ? r.run.answers : null }, by: r.by }
}

type Remote = { key: string; board: Bingo | null; result: ServerPlayerRun | null }

/**
 * Loads a board (when needBoard) and/or a player's run (when player is set) from
 * the server. Failures read as "not there", so the page falls back to its
 * not-found / unavailable messages.
 */
function useRemoteBingo(boardId: string | undefined, needBoard: boolean, player: string | undefined, runId: string | undefined) {
  const key = `${boardId ?? ''}|${needBoard ? 1 : 0}|${player ?? ''}|${runId ?? ''}`
  const active = !!boardId && (needBoard || !!player)
  const [state, setState] = useState<Remote | null>(null)

  useEffect(() => {
    if (!boardId || !active) return
    let alive = true
    Promise.all([
      needBoard ? bingoApi.board(boardId).catch(() => null) : Promise.resolve(null),
      player ? bingoApi.playerRun(boardId, player, runId).catch(() => null) : Promise.resolve(null),
    ]).then(([board, result]) => {
      if (!alive) return
      if (board || result) markServerBoard(boardId) // our own runs on it can sync now
      setState({ key, board, result })
    })
    return () => {
      alive = false
    }
  }, [key, active, boardId, needBoard, player, runId])

  const fresh = state?.key === key ? state : null
  return { board: fresh?.board ?? null, result: fresh?.result ?? null, loading: active && !fresh }
}
