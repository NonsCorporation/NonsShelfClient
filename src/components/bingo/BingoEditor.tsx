'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IoChatbubbleEllipsesOutline,
  IoCheckboxOutline,
  IoChevronBack,
  IoChevronForward,
  IoClipboardOutline,
  IoClose,
  IoPencilOutline,
  IoSearch,
  IoShuffleOutline,
  IoStar,
  IoTrashOutline,
} from 'react-icons/io5'
import MediaPicker from '@/components/media/MediaPicker'
import OfficialToggle from '@/components/official/OfficialToggle'
import { useIsAdmin } from '@/lib/useIsAdmin'
import BingoGrid from './BingoGrid'
import { ProgressBar, Segmented, Stepper, SwitchRow } from './BingoParts'
import {
  BINGO_CELL_MAX,
  BINGO_DEFAULT,
  BINGO_DESC_MAX,
  BINGO_MAX,
  BINGO_MIN,
  BINGO_TITLE_MAX,
  canFreeCenter,
  cellFromCatalog,
  centerIndex,
  clampSize,
  emptyCells,
  filledCount,
  newBingoId,
  resizeCells,
  type Bingo,
  type BingoCell,
  type BingoKind,
} from '@/lib/bingo'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  /** Existing board to edit, or a template to start from; omit for a blank one. */
  initial?: Bingo | null
  /** True when `initial` is the user's own board being edited in place (otherwise a new board is made). */
  isEdit?: boolean
  /** Name shown as the board's author. */
  author: string
  /** How many runs exist on this board; players keep their version when the squares change. */
  runsCount?: number
  onClose: () => void
  onSave: (b: Bingo) => void
}

const inputCls =
  'h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3.5 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

const PRESETS: [number, number][] = [[3, 3], [4, 4], [5, 5], [7, 7], [10, 10]]

type Tab = 'catalog' | 'text' | 'paste'

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</p>
}

// Create / edit a bingo. Mounted only while open, so the draft state simply
// initialises from `initial` — no syncing effects.
export default function BingoEditor({ initial, isEdit = false, author, runsCount = 0, onClose, onSave }: Props) {
  const { t } = useLanguage()
  const editingExisting = isEdit && !!initial
  const [kind, setKind] = useState<BingoKind>(initial?.kind ?? 'list')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [showDesc, setShowDesc] = useState(!!initial?.description)
  const isAdmin = useIsAdmin()
  // A template (someone else's board, or the starting point of a copy) is never official by itself.
  const [official, setOfficial] = useState(editingExisting && !!initial?.official)
  const [rows, setRows] = useState(initial?.rows ?? BINGO_DEFAULT)
  const [cols, setCols] = useState(initial?.cols ?? BINGO_DEFAULT)
  const [freeCenter, setFreeCenter] = useState((initial?.freeCenter ?? true) && canFreeCenter(rows, cols))
  const [cells, setCells] = useState<(BingoCell | null)[]>(initial?.cells ?? emptyCells(rows, cols))
  const [selected, setSelected] = useState<number | null>(() => {
    const cs = initial?.cells ?? emptyCells(rows, cols)
    const centre = (initial?.freeCenter ?? true) ? centerIndex(rows, cols) : null
    const first = cs.findIndex((c, i) => !c && i !== centre)
    return first === -1 ? null : first
  })
  const [tab, setTab] = useState<Tab>(initial?.kind === 'prompt' ? 'text' : 'catalog')
  const [text, setText] = useState('')
  const [bulk, setBulk] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [jumpRow, setJumpRow] = useState('')
  const [jumpCol, setJumpCol] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prev
    }
  }, [onClose])

  const prompt = kind === 'prompt'
  const total = rows * cols
  const centre = freeCenter ? centerIndex(rows, cols) : null
  const filled = filledCount({ cells, freeCenter, rows, cols })
  const complete = filled === total
  const canSave = title.trim().length > 0 && complete
  const freeAllowed = canFreeCenter(rows, cols)
  const big = rows > 10 || cols > 10
  const current = selected !== null ? cells[selected] : null

  const switchKind = (next: BingoKind) => {
    if (next === kind) return
    setKind(next)
    setTab(next === 'prompt' ? 'text' : 'catalog')
    // Prompt squares are plain descriptions, so drop any catalog details.
    if (next === 'prompt') setCells((cs) => cs.map((c) => (c ? { kind: 'text', title: c.title } : c)))
  }

  const applySize = (r: number, c: number) => {
    const nr = clampSize(r)
    const nc = clampSize(c)
    if (nr === rows && nc === cols) return
    setCells(resizeCells(cells, rows, cols, nr, nc))
    setRows(nr)
    setCols(nc)
    if (freeCenter && !canFreeCenter(nr, nc)) setFreeCenter(false)
    setSelected(null)
    setJumpRow('')
    setJumpCol('')
  }

  const nextEmpty = (from: number, next: (BingoCell | null)[]) => {
    for (let step = 1; step <= total; step++) {
      const i = (from + step) % total
      if (!next[i] && i !== centre) return i
    }
    return null
  }

  // Step to the previous / next square, skipping the free centre.
  const stepSelected = (dir: 1 | -1) => {
    let i = selected ?? (dir === 1 ? -1 : total)
    for (let n = 0; n < total; n++) {
      i = (i + dir + total) % total
      if (i !== centre) {
        setSelected(i)
        return
      }
    }
  }

  const place = (cell: BingoCell | null) => {
    if (selected === null) return
    const next = cells.map((c, i) => (i === selected ? cell : c))
    setCells(next)
    setText('')
    if (cell) setSelected(nextEmpty(selected, next))
  }

  const shuffle = () => {
    const idx = cells.map((_, i) => i).filter((i) => i !== centre)
    const items = idx.map((i) => cells[i])
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    const next = [...cells]
    idx.forEach((slot, k) => (next[slot] = items[k]))
    setCells(next)
  }

  // One entry per line, poured into the empty squares in reading order.
  const bulkLines = bulk
    .split('\n')
    .map((l) => l.trim().slice(0, BINGO_CELL_MAX))
    .filter(Boolean)
  const emptySquares = total - filled
  const addBulk = () => {
    const next = [...cells]
    let k = 0
    for (let i = 0; i < total && k < bulkLines.length; i++) {
      if (i === centre || next[i]) continue
      next[i] = { kind: 'text', title: bulkLines[k++] }
    }
    setCells(next)
    setBulk('')
    setSelected(nextEmpty(-1, next))
  }

  const jump = (r: string, c: string) => {
    setJumpRow(r)
    setJumpCol(c)
    const ri = Number(r)
    const ci = Number(c)
    if (Number.isInteger(ri) && Number.isInteger(ci) && ri >= 1 && ri <= rows && ci >= 1 && ci <= cols) {
      const i = (ri - 1) * cols + (ci - 1)
      if (i !== centre) setSelected(i)
    }
  }

  const submit = () => {
    if (!canSave) return
    onSave({
      id: editingExisting && initial ? initial.id : newBingoId(),
      kind,
      title: title.trim().slice(0, BINGO_TITLE_MAX),
      description: description.trim().slice(0, BINGO_DESC_MAX),
      // Official boards carry no author name.
      author: official ? '' : author,
      // Admins decide; for everyone else the flag just rides along unchanged (the server ignores it).
      official: isAdmin ? official : editingExisting ? initial?.official : undefined,
      freeCenter,
      rows,
      cols,
      // A free centre never holds a prompt of its own.
      cells: cells.map((c, i) => (i === centre ? null : c)),
      revision: editingExisting && initial ? initial.revision : 1,
      createdAt: editingExisting && initial ? initial.createdAt : Date.now(),
    })
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = prompt
    ? [
        { key: 'text', label: t('bingoTabPrompt'), icon: IoPencilOutline },
        { key: 'paste', label: t('bingoTabPastePrompts'), icon: IoClipboardOutline },
      ]
    : [
        { key: 'catalog', label: t('bingoTabSearch'), icon: IoSearch },
        { key: 'text', label: t('bingoTabType'), icon: IoPencilOutline },
        { key: 'paste', label: t('bingoTabPaste'), icon: IoClipboardOutline },
      ]

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--container)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--text)]">{editingExisting ? t('bingoEdit') : t('bingoNew')}</h3>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {editingExisting && runsCount > 0 && (
          <p className="mx-6 mb-3 rounded-xl border border-nonspremium/30 bg-nonspremium/10 px-4 py-3 text-xs leading-snug text-[var(--text)]">
            {t('bingoEditWarn', { n: runsCount })}
          </p>
        )}

        <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-6 pb-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* ───────── Left: the board ───────── */}
          <div className="flex flex-col gap-6">
            <section>
              <Label>{t('bingoSectionType')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'list', icon: IoCheckboxOutline, label: t('bingoKindList'), hint: t('bingoKindListHint') },
                    { key: 'prompt', icon: IoChatbubbleEllipsesOutline, label: t('bingoKindPrompt'), hint: t('bingoKindPromptHint') },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    disabled={editingExisting && kind !== k.key}
                    onClick={() => switchKind(k.key)}
                    aria-pressed={kind === k.key}
                    className={`flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-40 ${
                      kind === k.key ? 'border-nonsprimary bg-[var(--primary-soft)]' : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                      <k.icon className="h-4 w-4 text-nonsprimary" />
                      {k.label}
                    </span>
                    <span className="text-[11px] leading-snug text-[var(--text-muted)]">{k.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <Label>{t('bingoSectionBasics')}</Label>
              <input
                value={title}
                maxLength={BINGO_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('bingoTitlePlaceholder')}
                aria-label={t('title')}
                className={`${inputCls} text-base font-medium`}
              />
              {showDesc ? (
                <textarea
                  rows={2}
                  value={description}
                  maxLength={BINGO_DESC_MAX}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('bingoDescPlaceholder')}
                  aria-label={t('description')}
                  className="resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] p-3.5 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                />
              ) : (
                <button type="button" onClick={() => setShowDesc(true)} className="self-start text-sm font-medium text-nonsprimary hover:underline">
                  + {t('bingoAddDescription')}
                </button>
              )}
              <OfficialToggle checked={official} onChange={setOfficial} />
            </section>

            <section className="flex flex-col gap-3">
              <Label>{t('bingoSize')}</Label>
              <div className="flex items-end gap-3">
                <Stepper label={t('bingoRows')} value={rows} min={BINGO_MIN} max={BINGO_MAX} onChange={(n) => applySize(n, cols)} />
                <span className="pb-3 text-[var(--text-muted)]">×</span>
                <Stepper label={t('bingoCols')} value={cols} min={BINGO_MIN} max={BINGO_MAX} onChange={(n) => applySize(rows, n)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(([r, c]) => (
                  <button
                    key={`${r}x${c}`}
                    type="button"
                    onClick={() => applySize(r, c)}
                    aria-pressed={rows === r && cols === c}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      rows === r && cols === c ? 'bg-nonsprimary text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {r}×{c}
                  </button>
                ))}
              </div>
              <SwitchRow
                checked={freeCenter && freeAllowed}
                disabled={!freeAllowed}
                onChange={(v) => {
                  setFreeCenter(v)
                  setSelected(null)
                }}
                icon={IoStar}
                title={t('bingoFreeCenter')}
                hint={freeAllowed ? t('bingoFreeCenterHint') : t('bingoFreeCenterOdd')}
              />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label>{t('bingoSectionSquares')}</Label>
                <div className="-mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={shuffle}
                    title={t('bingoShuffle')}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    <IoShuffleOutline className="h-4 w-4" />
                    {t('bingoShuffle')}
                  </button>
                  {confirmClear ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCells(emptyCells(rows, cols))
                          setSelected(nextEmpty(-1, emptyCells(rows, cols)))
                          setConfirmClear(false)
                        }}
                        className="rounded-full bg-nonslightred/15 px-3 py-1.5 text-xs font-semibold text-nonslightred"
                      >
                        {t('bingoClearYes')}
                      </button>
                      <button type="button" onClick={() => setConfirmClear(false)} className="rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                        {t('cancel')}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      disabled={filled <= (centre !== null ? 1 : 0)}
                      className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-40"
                    >
                      <IoTrashOutline className="h-4 w-4" />
                      {t('bingoClearAll')}
                    </button>
                  )}
                </div>
              </div>
              <BingoGrid rows={rows} cols={cols} cells={cells} freeCenter={freeCenter} selected={selected} editing onCell={(i) => i !== centre && setSelected(i)} />
              {big && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="flex-shrink-0 font-medium">{t('bingoGoTo')}</span>
                  <input type="number" min={1} max={rows} value={jumpRow} onChange={(e) => jump(e.target.value, jumpCol)} placeholder={t('bingoRow')} aria-label={t('bingoRow')} className={`${inputCls} h-9 w-24`} />
                  <input type="number" min={1} max={cols} value={jumpCol} onChange={(e) => jump(jumpRow, e.target.value)} placeholder={t('bingoCol')} aria-label={t('bingoCol')} className={`${inputCls} h-9 w-24`} />
                </div>
              )}
            </section>
          </div>

          {/* ───────── Right: fill in the squares ───────── */}
          <div className="md:sticky md:top-0 md:self-start">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {selected === null ? t('bingoPickSquareShort') : t('bingoSquareRC', { r: Math.floor(selected / cols) + 1, c: (selected % cols) + 1 })}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{t('bingoFilled', { count: filled, total })}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => stepSelected(-1)}
                    aria-label={t('bingoPrevSquare')}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--container)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <IoChevronBack className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepSelected(1)}
                    aria-label={t('bingoNextSquare')}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--container)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    <IoChevronForward className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selected === null && complete && (
                <p className="mb-3 rounded-xl bg-[var(--primary-soft)] px-3.5 py-3 text-sm text-[var(--text)]">{t('bingoAllFilled')}</p>
              )}

              {current && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-[var(--container)] px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-sm text-[var(--text)]">{current.title}</span>
                  <button type="button" onClick={() => place(null)} className="flex-shrink-0 text-xs font-medium text-nonslightred hover:underline">
                    {t('bingoClearSquare')}
                  </button>
                </div>
              )}

              <Segmented options={tabs} value={tab} onChange={setTab} className="mb-3" />

              {tab === 'catalog' && !prompt && (
                <div className={selected === null ? 'pointer-events-none opacity-50' : ''}>
                  <MediaPicker onPick={(item) => place(cellFromCatalog(item))} />
                </div>
              )}

              {tab === 'text' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const v = text.trim()
                    if (v) place({ kind: 'text', title: v.slice(0, BINGO_CELL_MAX) })
                  }}
                  className="flex flex-col gap-2"
                >
                  {prompt && <p className="text-xs text-[var(--text-muted)]">{t('bingoPromptHelp')}</p>}
                  <input
                    value={text}
                    maxLength={BINGO_CELL_MAX}
                    disabled={selected === null}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={prompt ? t('bingoPromptPlaceholder') : t('bingoTextPlaceholder')}
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || selected === null}
                    className="h-11 rounded-xl bg-nonsprimary px-4 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
                  >
                    {prompt ? t('bingoUsePrompt') : t('bingoUseText')}
                  </button>
                </form>
              )}

              {tab === 'paste' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[var(--text-muted)]">{t('bingoBulkHint')}</p>
                  <textarea
                    rows={7}
                    value={bulk}
                    onChange={(e) => setBulk(e.target.value)}
                    placeholder={t('bingoBulkPlaceholder')}
                    className="resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] p-3.5 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  />
                  <button
                    type="button"
                    onClick={addBulk}
                    disabled={bulkLines.length === 0 || emptySquares === 0}
                    className="h-11 rounded-xl bg-nonsprimary px-4 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
                  >
                    {t('bingoBulkAdd', { count: Math.min(bulkLines.length, emptySquares) })}
                  </button>
                  {bulkLines.length > emptySquares && emptySquares > 0 && (
                    <p className="text-xs text-[var(--text-muted)]">{t('bingoBulkExtra', { n: bulkLines.length - emptySquares })}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ───────── Footer ───────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[var(--border-subtle)] px-6 py-4">
          <div className="min-w-[10rem] flex-1">
            <ProgressBar value={filled} total={total} label={t('bingoFilled', { count: filled, total })} />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">{canSave ? t('bingoReadyToSave') : title.trim() ? t('bingoFilledProgress', { count: filled, total }) : t('bingoNeedAll')}</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!canSave}
              className="rounded-full bg-nonsprimary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
