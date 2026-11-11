'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from '@/lib/router'
import {
  IoAdd,
  IoArrowBack,
  IoCheckmark,
  IoCopyOutline,
  IoCreateOutline,
  IoGridOutline,
  IoLinkOutline,
  IoRefresh,
  IoTrashOutline,
  IoTrophyOutline,
} from 'react-icons/io5'
import BingoGrid from './BingoGrid'
import BingoEditor from './BingoEditor'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  BINGO_CELLS,
  COMMUNITY_BINGOS,
  completedLines,
  decodeShare,
  newBingoId,
  shareUrl,
  tickedCount,
  useBingos,
  type Bingo,
} from '@/lib/bingo'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useLoginModal } from '@/contexts/LoginModalContext'

/** Short stable id for a shared payload so ticks on a shared board persist. */
function shareKey(payload: string): string {
  let h = 0
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) >>> 0
  return `shared-${h.toString(36)}`
}

// Discover → Bingo tab. Mock only: boards live in this browser's localStorage;
// "share" produces a link that carries the whole board.
export default function BingoTab() {
  const { t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { openLogin } = useLoginModal()
  const { mine, marks, save, remove, toggle, clearMarks } = useBingos()
  const [params, setParams] = useSearchParams()

  const me = user?.name || user?.username || t('bingoYou')
  const boardId = params.get('b')
  const sharePayload = params.get('share')

  const [editor, setEditor] = useState<{ initial: Bingo | null; isEdit: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState<'link' | 'saved' | null>(null)

  const shared = useMemo(() => (sharePayload ? decodeShare(sharePayload) : null), [sharePayload])

  // Resolve the open board: a share link wins, then mine, then community.
  const open: { board: Bingo; key: string; kind: 'mine' | 'community' | 'shared' } | null = useMemo(() => {
    if (sharePayload && shared) {
      const key = shareKey(sharePayload)
      return { board: { ...shared, id: key }, key, kind: 'shared' }
    }
    if (boardId) {
      const own = mine.find((b) => b.id === boardId)
      if (own) return { board: own, key: own.id, kind: 'mine' }
      const com = COMMUNITY_BINGOS.find((b) => b.id === boardId)
      if (com) return { board: com, key: com.id, kind: 'community' }
    }
    return null
  }, [sharePayload, shared, boardId, mine])

  const go = (next: { b?: string }) => {
    const p = new URLSearchParams()
    p.set('tab', 'bingo')
    if (next.b) p.set('b', next.b)
    setParams(p)
  }

  const flash = (kind: 'link' | 'saved') => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const startNew = () => (isAuthenticated ? setEditor({ initial: null, isEdit: false }) : openLogin())

  const onSave = (b: Bingo) => {
    save(b)
    setEditor(null)
    go({ b: b.id })
  }

  const copyLink = async (b: Bingo) => {
    const url = shareUrl(b)
    try {
      await navigator.clipboard.writeText(url)
      flash('link')
    } catch {
      window.prompt(t('bingoShare'), url)
    }
  }

  const saveCopy = (b: Bingo) => {
    if (!isAuthenticated) return openLogin()
    const copy: Bingo = { ...b, id: newBingoId(), author: me, createdAt: Date.now() }
    save(copy)
    flash('saved')
    go({ b: copy.id })
  }

  // ── detail view ──
  if (open) {
    const { board, key, kind } = open
    const m = marks[key]
    const lines = completedLines(m, board.freeCenter)
    const winning = new Set(lines.flat())
    const ticked = tickedCount(m, board.freeCenter)
    const blackout = ticked === BINGO_CELLS

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
          <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">{board.title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {kind === 'shared' && board.author ? t('bingoSharedBy', { name: board.author }) : board.author ? t('bingoBy', { name: board.author }) : ''}
          </p>
          {board.description && <p className="mt-2 text-sm text-[var(--text-muted)]">{board.description}</p>}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-medium text-[var(--text)]">{t('bingoProgress', { count: ticked })}</span>
          <span className="text-sm text-[var(--text-muted)]">{t('bingoLines', { count: lines.length })}</span>
        </div>

        {lines.length > 0 && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-nonspremium/40 bg-nonspremium/10 px-4 py-3 text-sm font-medium text-[var(--text)]">
            <IoTrophyOutline className="h-5 w-5 flex-shrink-0 text-nonspremium" />
            {blackout ? t('bingoBlackout') : `${t('bingoWin')} ${t('bingoLines', { count: lines.length })}`}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 sm:p-4">
          <BingoGrid
            cells={board.cells}
            freeCenter={board.freeCenter}
            marks={m ?? []}
            winning={winning}
            onCell={(i) => toggle(key, i)}
          />
        </div>
        <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">{t('bingoTapHint')}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton primary onClick={() => copyLink(board)} icon={copied === 'link' ? IoCheckmark : IoLinkOutline}>
            {copied === 'link' ? t('bingoCopied') : t('bingoShare')}
          </ActionButton>
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
          {ticked > (board.freeCenter ? 1 : 0) && (
            <ActionButton onClick={() => clearMarks(key)} icon={IoRefresh}>
              {t('bingoResetTicks')}
            </ActionButton>
          )}
        </div>

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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-[var(--text-muted)]">{t('bingoSubtitle')}</p>
        <button
          onClick={startNew}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-nonsprimary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus"
        >
          <IoAdd className="h-4 w-4" />
          {t('bingoNew')}
        </button>
      </div>

      {(invalidShare || notFound) && (
        <p className="mb-5 rounded-xl border border-nonslightred/40 bg-nonslightred/10 px-4 py-3 text-sm text-[var(--text)]">
          {invalidShare ? t('bingoSharedInvalid') : t('bingoNotFound')}
        </p>
      )}

      <SectionTitle>{t('bingoYours')}</SectionTitle>
      {mine.length === 0 ? (
        <div className="mb-8 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)]">
            <IoGridOutline className="h-6 w-6 text-[var(--text-muted)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text)]">{t('bingoNoneYet')}</p>
          <p className="text-xs text-[var(--text-muted)]">{t('bingoNoneHint')}</p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mine.map((b) => (
            <BingoCard key={b.id} board={b} marks={marks[b.id]} mine onOpen={() => go({ b: b.id })} />
          ))}
        </div>
      )}

      <SectionTitle>{t('bingoCommunity')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COMMUNITY_BINGOS.map((b) => (
          <BingoCard key={b.id} board={b} marks={marks[b.id]} onOpen={() => go({ b: b.id })} />
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

function BingoCard({ board, marks, mine, onOpen }: { board: Bingo; marks?: boolean[]; mine?: boolean; onOpen: () => void }) {
  const { t } = useLanguage()
  const ticked = tickedCount(marks, board.freeCenter)
  const lines = completedLines(marks, board.freeCenter).length
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3 text-left transition-transform hover:-translate-y-1"
    >
      <BingoGrid cells={board.cells} freeCenter={board.freeCenter} marks={marks ?? []} variant="mini" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text)] group-hover:text-nonsprimary">{board.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]">
          {mine ? <span className="rounded-full bg-[var(--primary-soft)] px-1.5 py-px text-[10px] font-semibold text-nonsprimary">{t('bingoYoursTag')}</span> : t('bingoBy', { name: board.author })}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          {t('bingoProgress', { count: ticked })}
          {lines > 0 && <span className="ml-1.5 font-semibold text-nonspremium">· {t('bingoLines', { count: lines })}</span>}
        </p>
      </div>
    </button>
  )
}
