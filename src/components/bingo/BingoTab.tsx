'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/router'
import {
  IoAdd,
  IoArrowBack,
  IoChatbubbleEllipsesOutline,
  IoCheckboxOutline,
  IoCheckmark,
  IoCopyOutline,
  IoCreateOutline,
  IoGridOutline,
  IoLinkOutline,
  IoPeopleOutline,
  IoRefresh,
  IoTrashOutline,
  IoTrophyOutline,
} from 'react-icons/io5'
import BingoGrid from './BingoGrid'
import BingoEditor from './BingoEditor'
import BingoAnswerModal from './BingoAnswerModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  BINGO_CELLS,
  COMMUNITY_BINGOS,
  completedLines,
  decodeShare,
  doneCount,
  encodeShare,
  newBingoId,
  progressMask,
  shareUrl,
  useBingos,
  type Bingo,
  type BingoKind,
} from '@/lib/bingo'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useLoginModal } from '@/contexts/LoginModalContext'

/** Short stable id for a shared board so ticks and answers on it persist. */
function shareKey(payload: string): string {
  let h = 0
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) >>> 0
  return `shared-${h.toString(36)}`
}

type Filter = 'all' | BingoKind

// Discover → Bingo tab. Mock only: boards live in this browser's localStorage;
// "share" produces a link that carries the whole board (and, for prompt
// boards, optionally your answers).
export default function BingoTab() {
  const { t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { openLogin } = useLoginModal()
  const { mine, marks, answers, save, remove, toggle, setAnswer, clearProgress } = useBingos()
  const [params, setParams] = useSearchParams()

  const me = user?.name || user?.username || t('bingoYou')
  const boardId = params.get('b')
  const sharePayload = params.get('share')
  const wantsOwn = params.has('own')

  const [filter, setFilter] = useState<Filter>('all')
  const [editor, setEditor] = useState<{ initial: Bingo | null; isEdit: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [answering, setAnswering] = useState<number | null>(null)
  const [copied, setCopied] = useState<'link' | 'answers' | 'saved' | null>(null)

  const shared = useMemo(() => (sharePayload ? decodeShare(sharePayload) : null), [sharePayload])

  // Resolve the open board: a share link wins, then mine, then community.
  const open = useMemo(() => {
    if (sharePayload && shared) {
      // Key on the template alone, so the sharer's answers don't change which board your own progress belongs to.
      const key = shareKey(encodeShare(shared.board))
      return { board: { ...shared.board, id: key }, key, kind: 'shared' as const }
    }
    if (boardId) {
      const own = mine.find((b) => b.id === boardId)
      if (own) return { board: own, key: own.id, kind: 'mine' as const }
      const com = COMMUNITY_BINGOS.find((b) => b.id === boardId)
      if (com) return { board: com, key: com.id, kind: 'community' as const }
    }
    return null
  }, [sharePayload, shared, boardId, mine])

  const go = (next: { b?: string }) => {
    const p = new URLSearchParams()
    p.set('tab', 'bingo')
    if (next.b) p.set('b', next.b)
    setParams(p)
  }

  const flash = (kind: 'link' | 'answers' | 'saved') => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const startNew = () => (isAuthenticated ? setEditor({ initial: null, isEdit: false }) : openLogin())

  const onSave = (b: Bingo) => {
    save(b)
    setEditor(null)
    go({ b: b.id })
  }

  const copy = async (url: string, kind: 'link' | 'answers') => {
    try {
      await navigator.clipboard.writeText(url)
      flash(kind)
    } catch {
      window.prompt(t('bingoShare'), url)
    }
  }

  const saveCopy = (b: Bingo) => {
    if (!isAuthenticated) return openLogin()
    const dupe: Bingo = { ...b, id: newBingoId(), author: me, createdAt: Date.now() }
    save(dupe)
    flash('saved')
    go({ b: dupe.id })
  }

  // ── detail view ──
  if (open) {
    const { board, key, kind } = open
    const prompt = board.kind === 'prompt'
    // A link that carries someone's answers opens read-only until you choose to fill in your own.
    const theirs = kind === 'shared' && prompt && !!shared?.answers && !wantsOwn
    const shownAnswers = theirs ? shared!.answers : answers[key]
    const mask = progressMask(board, marks[key], shownAnswers ?? undefined)
    const lines = completedLines(mask)
    const winning = new Set(lines.flat())
    const done = doneCount(mask)
    const everything = done === BINGO_CELLS
    const hasProgress = done > (board.freeCenter ? 1 : 0)
    const hasOwnAnswers = !!answers[key]?.some(Boolean)

    const byline =
      kind === 'shared' && board.author ? t('bingoSharedBy', { name: board.author }) : board.author ? t('bingoBy', { name: board.author }) : ''

    return (
      <div className="mx-auto max-w-2xl animate-fade-up">
        <button
          onClick={() => go({})}
          className="mb-4 flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <IoArrowBack className="h-4 w-4" />
          {t('bingoBack')}
        </button>

        <div className="mb-4">
          <KindTag kind={board.kind} />
          <h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--text)]">{board.title}</h2>
          {byline && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{byline}</p>}
          {board.description && <p className="mt-2 text-sm text-[var(--text-muted)]">{board.description}</p>}
        </div>

        {theirs && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--primary-ring)] bg-[var(--primary-soft)] px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <IoPeopleOutline className="mt-0.5 h-5 w-5 flex-shrink-0 text-nonsprimary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">{t('bingoTheirAnswers', { name: shared?.by || board.author || '?' })}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('bingoTheirAnswersHint')}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const p = new URLSearchParams(params)
                p.set('own', '1')
                setParams(p)
              }}
              className="flex-shrink-0 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
            >
              {t('bingoFillMine')}
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-medium text-[var(--text)]">
            {prompt ? t('bingoFilledCount', { count: done }) : t('bingoProgress', { count: done })}
          </span>
          <span className="text-sm text-[var(--text-muted)]">{t('bingoLines', { count: lines.length })}</span>
        </div>

        {lines.length > 0 && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-nonspremium/40 bg-nonspremium/10 px-4 py-3 text-sm font-medium text-[var(--text)]">
            <IoTrophyOutline className="h-5 w-5 flex-shrink-0 text-nonspremium" />
            {everything ? (prompt ? t('bingoAllAnswered') : t('bingoAllTicked')) : `${t('bingoWin')} ${t('bingoLines', { count: lines.length })}`}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 sm:p-4">
          <BingoGrid
            cells={board.cells}
            freeCenter={board.freeCenter}
            kind={board.kind}
            mask={mask}
            answers={shownAnswers}
            winning={winning}
            onCell={theirs ? undefined : (i) => (prompt ? setAnswering(i) : toggle(key, i))}
          />
        </div>
        {!theirs && <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">{prompt ? t('bingoTapFillHint') : t('bingoTapHint')}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton primary onClick={() => copy(shareUrl(board), 'link')} icon={copied === 'link' ? IoCheckmark : IoLinkOutline}>
            {copied === 'link' ? t('bingoCopied') : t('bingoShare')}
          </ActionButton>
          {prompt && hasOwnAnswers && !theirs && (
            <ActionButton onClick={() => copy(shareUrl(board, answers[key], me), 'answers')} icon={copied === 'answers' ? IoCheckmark : IoPeopleOutline}>
              {copied === 'answers' ? t('bingoCopied') : t('bingoShareAnswers')}
            </ActionButton>
          )}
          {kind === 'mine' ? (
            <>
              <ActionButton onClick={() => setEditor({ initial: board, isEdit: true })} icon={IoCreateOutline}>
                {t('bingoEdit')}
              </ActionButton>
              <ActionButton danger onClick={() => setConfirmDelete(true)} icon={IoTrashOutline}>
                {t('bingoDelete')}
              </ActionButton>
            </>
          ) : (
            <ActionButton onClick={() => saveCopy(board)} icon={copied === 'saved' ? IoCheckmark : IoCopyOutline}>
              {copied === 'saved' ? t('bingoCopySaved') : t('bingoCopy')}
            </ActionButton>
          )}
          {hasProgress && !theirs && (
            <ActionButton onClick={() => clearProgress(key)} icon={IoRefresh}>
              {prompt ? t('bingoResetAnswers') : t('bingoResetTicks')}
            </ActionButton>
          )}
        </div>

        {answering !== null && board.cells[answering] && (
          <BingoAnswerModal
            prompt={board.cells[answering]!.title}
            current={answers[key]?.[answering] ?? null}
            onClose={() => setAnswering(null)}
            onAnswer={(cell) => {
              setAnswer(key, answering, cell)
              setAnswering(null)
            }}
          />
        )}
        {editor && <BingoEditor initial={editor.initial} isEdit={editor.isEdit} author={me} onClose={() => setEditor(null)} onSave={onSave} />}
        {confirmDelete && (
          <ConfirmModal
            title={t('bingoDeleteTitle')}
            message={t('bingoDeleteText')}
            confirmText={t('bingoDelete')}
            cancelText={t('cancel')}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              remove(board.id)
              setConfirmDelete(false)
              go({})
            }}
          />
        )}
      </div>
    )
  }

  // ── list view ──
  const invalidShare = !!sharePayload && !shared
  const notFound = !!boardId && !sharePayload
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

      {(invalidShare || notFound) && (
        <p className="mb-5 rounded-xl border border-nonslightred/40 bg-nonslightred/10 px-4 py-3 text-sm text-[var(--text)]">
          {invalidShare ? t('bingoSharedInvalid') : t('bingoNotFound')}
        </p>
      )}

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
            <BingoCard key={b.id} board={b} marks={marks[b.id]} answers={answers[b.id]} mine onOpen={() => go({ b: b.id })} />
          ))}
        </div>
      )}

      <SectionTitle>{t('bingoCommunity')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {communityBoards.map((b) => (
          <BingoCard key={b.id} board={b} marks={marks[b.id]} answers={answers[b.id]} onOpen={() => go({ b: b.id })} />
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--text-muted)]">{t('bingoMockNote')}</p>

      {editor && <BingoEditor initial={editor.initial} isEdit={editor.isEdit} author={me} onClose={() => setEditor(null)} onSave={onSave} />}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</h3>
}

function KindTag({ kind }: { kind: BingoKind }) {
  const { t } = useLanguage()
  const Icon = kind === 'prompt' ? IoChatbubbleEllipsesOutline : IoCheckboxOutline
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
      <Icon className="h-3 w-3" />
      {kind === 'prompt' ? t('bingoTagPrompt') : t('bingoTagList')}
    </span>
  )
}

function ActionButton({
  children,
  onClick,
  icon: Icon,
  primary,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
        primary
          ? 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
          : danger
            ? 'bg-[var(--surface)] text-nonslightred hover:bg-[var(--surface-hover)]'
            : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

function BingoCard({
  board,
  marks,
  answers,
  mine,
  onOpen,
}: {
  board: Bingo
  marks?: boolean[]
  answers?: Bingo['cells']
  mine?: boolean
  onOpen: () => void
}) {
  const { t } = useLanguage()
  const prompt = board.kind === 'prompt'
  const mask = progressMask(board, marks, answers)
  const done = doneCount(mask)
  const lines = completedLines(mask).length
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 text-left transition-transform hover:-translate-y-1"
    >
      <BingoGrid cells={board.cells} freeCenter={board.freeCenter} kind={board.kind} mask={mask} answers={answers} variant="mini" />
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <KindTag kind={board.kind} />
          {mine && <span className="rounded-full bg-[var(--primary-soft)] px-1.5 py-px text-[10px] font-semibold text-nonsprimary">{t('bingoYoursTag')}</span>}
        </div>
        <p className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{board.title}</p>
        {!mine && <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{t('bingoBy', { name: board.author })}</p>}
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          {prompt ? t('bingoFilledCount', { count: done }) : t('bingoProgress', { count: done })}
          {lines > 0 && <span className="ml-1.5 font-semibold text-nonspremium">· {t('bingoLines', { count: lines })}</span>}
        </p>
      </div>
    </button>
  )
}
