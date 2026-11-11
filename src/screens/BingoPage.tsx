'use client'

import { useEffect, useState } from 'react'
import {
  IoAdd,
  IoArrowBack,
  IoCheckmark,
  IoCheckmarkDoneOutline,
  IoCopyOutline,
  IoCreateOutline,
  IoImageOutline,
  IoLinkOutline,
  IoLockOpenOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoRefresh,
  IoTrashOutline,
  IoTrophyOutline,
} from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import BingoGrid from '../components/bingo/BingoGrid'
import BingoEditor from '../components/bingo/BingoEditor'
import BingoAnswerModal from '../components/bingo/BingoAnswerModal'
import BingoShareModal from '../components/bingo/BingoShareModal'
import { ActionButton, KindTag } from '../components/bingo/BingoParts'
import ConfirmModal from '../components/ui/ConfirmModal'
import { Link, useLocation, useNavigate, useSearchParams } from '../lib/router'
import {
  COMMUNITY_BINGOS,
  bingoPath,
  boardAtRevision,
  bingoShareUrl,
  completedLines,
  decodeShare,
  doneCount,
  copyOfBingo,
  progressMask,
  useBingos,
  type Bingo,
} from '../lib/bingo'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useLoginModal } from '../contexts/LoginModalContext'

type Copied = 'board' | 'result' | 'saved' | null

// /bingo/<board uuid>                    the board, with your own runs
// /bingo/<board uuid>/<user uuid>        that user's latest run
// /bingo/<board uuid>/<user uuid>/<run>  one specific run (a finished result worth sharing)
// Mock only: until there is a server, a link also carries the board and the
// result in its `d` parameter so it opens in any browser.
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
  const [copied, setCopied] = useState<Copied>(null)

  // /bingo on its own has nothing to show.
  useEffect(() => {
    if (!boardId) navigate('/discover?tab=bingo', { replace: true })
  }, [boardId, navigate])

  const payload = params.get('d')
  const decoded = payload && boardId ? decodeShare(payload, boardId) : null

  const own = store.mine.find((b) => b.id === boardId)
  const com = COMMUNITY_BINGOS.find((b) => b.id === boardId)
  const resolved: { board: Bingo; source: 'mine' | 'community' | 'shared' } | null = own
    ? { board: own, source: 'mine' }
    : com
      ? { board: com, source: 'community' }
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
  const unavailable = !theirs && !!userSeg && !viewingSelf
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
    source === 'shared' && latest.author ? t('bingoSharedBy', { name: latest.author }) : latest.author ? t('bingoBy', { name: latest.author }) : ''

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

  return (
    <Layout>
      <div className="mx-auto max-w-2xl animate-fade-up">
        {back}

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindTag kind={board.kind} />
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              {board.rows}×{board.cols}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--text)]">{latest.title}</h1>
          {byline && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{byline}</p>}
          {latest.description && <p className="mt-2 text-sm text-[var(--text-muted)]">{latest.description}</p>}
        </div>

        {theirs && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--primary-ring)] bg-[var(--primary-soft)] px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <IoPeopleOutline className="mt-0.5 h-5 w-5 flex-shrink-0 text-nonsprimary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">{t('bingoTheirResult', { name: decoded?.by || board.author || '?' })}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('bingoTheirResultHint')}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(bingoPath(board.id))}
              className="flex-shrink-0 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              {t('bingoPlayMine')}
            </button>
          </div>
        )}
        {outdated && activeRun && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-nonspremium/40 bg-nonspremium/10 px-4 py-3">
            <p className="min-w-0 text-sm text-[var(--text)]">{activeRun.finishedAt ? t('bingoOutdatedFinished') : t('bingoOutdatedRun')}</p>
            {!activeRun.finishedAt && (
              <button
                onClick={() => setConfirm('update')}
                className="flex-shrink-0 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
              >
                {t('bingoUpdateRun')}
              </button>
            )}
          </div>
        )}
        {editedSince && (
          <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{t('bingoEditedSince')}</p>
        )}
        {unavailable && (
          <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">{t('bingoResultUnavailable')}</p>
        )}

        {/* Runs: every play-through of this board, each with its own link */}
        {!theirs && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {ownRuns.map((r, i) => (
              <button
                key={r.id}
                onClick={() => goRun(r.id)}
                aria-pressed={activeRun?.id === r.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeRun?.id === r.id ? 'bg-nonsprimary text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {r.finishedAt && <IoCheckmark className="h-3.5 w-3.5" />}
                {t('bingoRunN', { n: i + 1 })}
              </button>
            ))}
            <button
              onClick={newRun}
              className="flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <IoAdd className="h-3.5 w-3.5" />
              {t('bingoNewRun')}
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-medium text-[var(--text)]">
            {prompt ? t('bingoFilledCount', { count: done, total }) : t('bingoProgress', { count: done, total })}
          </span>
          <span className="text-sm text-[var(--text-muted)]">{t('bingoLines', { count: lines.length })}</span>
        </div>

        {lines.length > 0 && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-nonspremium/40 bg-nonspremium/10 px-4 py-3 text-sm font-medium text-[var(--text)]">
            <IoTrophyOutline className="h-5 w-5 flex-shrink-0 text-nonspremium" />
            {everything ? (prompt ? t('bingoAllAnswered') : t('bingoAllTicked')) : `${t('bingoWin')} ${t('bingoLines', { count: lines.length })}`}
          </div>
        )}

        {!theirs && activeRun?.finishedAt && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
            <p className="text-sm text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">{t('bingoFinishedBanner')}</span> · {new Date(activeRun.finishedAt).toLocaleDateString()} · {t('bingoRunLocked')}
            </p>
            <button
              onClick={() => store.reopenRun(board.id, activeRun.id)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[var(--container)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              <IoLockOpenOutline className="h-3.5 w-3.5" />
              {t('bingoReopen')}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 sm:p-4">
          <BingoGrid
            rows={board.rows}
            cols={board.cols}
            cells={board.cells}
            freeCenter={board.freeCenter}
            kind={board.kind}
            mask={mask}
            answers={answers}
            winning={winning}
            onCell={onCell}
          />
        </div>
        {!locked && <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">{prompt ? t('bingoTapFillHint') : t('bingoTapHint')}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton primary onClick={() => copy(boardLink().url, 'board')} icon={copied === 'board' ? IoCheckmark : IoLinkOutline}>
            {copied === 'board' ? t('bingoCopied') : t('bingoShareBoard')}
          </ActionButton>
          {hasProgress && (theirs || activeRun) && (
            <ActionButton onClick={() => copy(resultLink().url, 'result')} icon={copied === 'result' ? IoCheckmark : IoPersonOutline}>
              {copied === 'result' ? t('bingoCopied') : t('bingoShareResult')}
            </ActionButton>
          )}
          <ActionButton onClick={() => setShowCard(true)} icon={IoImageOutline}>
            {t('bingoCard')}
          </ActionButton>
          {source === 'mine' ? (
            <>
              <ActionButton onClick={() => setEditor(true)} icon={IoCreateOutline}>
                {t('bingoEdit')}
              </ActionButton>
              <ActionButton danger onClick={() => setConfirm('board')} icon={IoTrashOutline}>
                {t('bingoDelete')}
              </ActionButton>
            </>
          ) : (
            <ActionButton onClick={saveCopy} icon={copied === 'saved' ? IoCheckmark : IoCopyOutline}>
              {copied === 'saved' ? t('bingoCopySaved') : t('bingoCopy')}
            </ActionButton>
          )}
        </div>

        {/* Run actions */}
        {!theirs && activeRun && (
          <div className="mt-2 flex flex-wrap gap-2">
            {!activeRun.finishedAt && hasProgress && (
              <ActionButton onClick={() => store.finishRun(board.id, activeRun.id)} icon={IoCheckmarkDoneOutline}>
                {t('bingoFinishRun')}
              </ActionButton>
            )}
            {!activeRun.finishedAt && hasProgress && (
              <ActionButton onClick={() => store.resetRun(board.id, activeRun.id)} icon={IoRefresh}>
                {prompt ? t('bingoResetAnswers') : t('bingoResetTicks')}
              </ActionButton>
            )}
            <ActionButton danger onClick={() => setConfirm('run')} icon={IoTrashOutline}>
              {t('bingoDeleteRun')}
            </ActionButton>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--text-muted)]">{t('bingoMockNote')}</p>

        {answering !== null && board.cells[answering] && (
          <BingoAnswerModal
            prompt={board.cells[answering]!.title}
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
