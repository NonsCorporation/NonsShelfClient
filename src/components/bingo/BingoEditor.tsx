'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoChatbubbleEllipsesOutline, IoCheckboxOutline, IoClose, IoShuffleOutline, IoStar, IoTrashOutline } from 'react-icons/io5'
import MediaPicker from '@/components/media/MediaPicker'
import BingoGrid from './BingoGrid'
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
  'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

const PRESETS: [number, number][] = [[3, 3], [4, 4], [5, 5], [7, 7], [10, 10]]

// Create / edit a bingo. Mounted only while open, so the draft state simply
// initialises from `initial` — no syncing effects.
export default function BingoEditor({ initial, isEdit = false, author, runsCount = 0, onClose, onSave }: Props) {
  const { t } = useLanguage()
  const editingExisting = isEdit && !!initial
  const [kind, setKind] = useState<BingoKind>(initial?.kind ?? 'list')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [rows, setRows] = useState(initial?.rows ?? BINGO_DEFAULT)
  const [cols, setCols] = useState(initial?.cols ?? BINGO_DEFAULT)
  const [rowsStr, setRowsStr] = useState(String(initial?.rows ?? BINGO_DEFAULT))
  const [colsStr, setColsStr] = useState(String(initial?.cols ?? BINGO_DEFAULT))
  const [freeCenter, setFreeCenter] = useState((initial?.freeCenter ?? true) && canFreeCenter(rows, cols))
  const [cells, setCells] = useState<(BingoCell | null)[]>(initial?.cells ?? emptyCells(rows, cols))
  const [selected, setSelected] = useState<number | null>(() => {
    const cs = initial?.cells ?? emptyCells(rows, cols)
    const centre = (initial?.freeCenter ?? true) ? centerIndex(rows, cols) : null
    const first = cs.findIndex((c, i) => !c && i !== centre)
    return first === -1 ? null : first
  })
  const [mode, setMode] = useState<'catalog' | 'text'>(initial?.kind === 'prompt' ? 'text' : 'catalog')
  const [text, setText] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState('')
  const [jumpRow, setJumpRow] = useState('')
  const [jumpCol, setJumpCol] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const prompt = kind === 'prompt'
  const total = rows * cols
  const centre = freeCenter ? centerIndex(rows, cols) : null
  const filled = filledCount({ cells, freeCenter, rows, cols })
  const complete = filled === total
  const canSave = title.trim().length > 0 && complete
  const freeAllowed = canFreeCenter(rows, cols)

  const switchKind = (next: BingoKind) => {
    if (next === kind) return
    setKind(next)
    setMode(next === 'prompt' ? 'text' : 'catalog')
    // Prompt squares are plain descriptions, so drop any catalog details.
    if (next === 'prompt') setCells((cs) => cs.map((c) => (c ? { kind: 'text', title: c.title } : c)))
  }

  const applySize = (r: number, c: number) => {
    const nr = clampSize(r)
    const nc = clampSize(c)
    setRowsStr(String(nr))
    setColsStr(String(nc))
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
      author,
      freeCenter,
      rows,
      cols,
      // A free centre never holds a prompt of its own.
      cells: cells.map((c, i) => (i === centre ? null : c)),
      revision: editingExisting && initial ? initial.revision : 1,
      createdAt: editingExisting && initial ? initial.createdAt : Date.now(),
    })
  }

  const current = selected !== null ? cells[selected] : null
  const sizeInput = (value: string, set: (v: string) => void, commit: () => void, label: string) => (
    <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={BINGO_MIN}
        max={BINGO_MAX}
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={inputCls}
      />
    </label>
  )

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--container)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-lg font-semibold text-[var(--text)]">{editingExisting ? t('bingoEdit') : t('bingoNew')}</h3>
          <button
            onClick={onClose}
            aria-label={t('cancel')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {editingExisting && runsCount > 0 && (
          <p className="border-b border-nonspremium/30 bg-nonspremium/10 px-5 py-3 text-xs leading-snug text-[var(--text)]">
            {t('bingoEditWarn', { n: runsCount })}
          </p>
        )}

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: details + the board */}
          <div className="flex flex-col gap-4">
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
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-40 ${
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

            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('title')}
              <input value={title} maxLength={BINGO_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={t('bingoTitlePlaceholder')} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('description')}
              <textarea
                rows={2}
                value={description}
                maxLength={BINGO_DESC_MAX}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('bingoDescPlaceholder')}
                className="resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            </label>

            {/* Size */}
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <p className="text-sm font-medium text-[var(--text)]">{t('bingoSize')}</p>
              <div className="flex items-end gap-2">
                {sizeInput(rowsStr, setRowsStr, () => applySize(Number(rowsStr), cols), t('bingoRows'))}
                <span className="pb-2.5 text-sm text-[var(--text-muted)]">×</span>
                {sizeInput(colsStr, setColsStr, () => applySize(rows, Number(colsStr)), t('bingoCols'))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(([r, c]) => (
                  <button
                    key={`${r}x${c}`}
                    type="button"
                    onClick={() => applySize(r, c)}
                    aria-pressed={rows === r && cols === c}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      rows === r && cols === c ? 'bg-nonsprimary text-white' : 'bg-[var(--container)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {r}×{c}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{t('bingoSizeHint', { min: BINGO_MIN, max: BINGO_MAX })}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={freeCenter}
              disabled={!freeAllowed}
              onClick={() => {
                setFreeCenter((v) => !v)
                setSelected(null)
              }}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-3 text-left disabled:opacity-50"
            >
              <span className="flex items-center gap-2.5">
                <IoStar className="h-4 w-4 text-nonsprimary" />
                <span>
                  <span className="block text-sm font-medium text-[var(--text)]">{t('bingoFreeCenter')}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{freeAllowed ? t('bingoFreeCenterHint') : t('bingoFreeCenterOdd')}</span>
                </span>
              </span>
              <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${freeCenter ? 'bg-nonsprimary' : 'bg-[var(--surface-active)]'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${freeCenter ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>

            <BingoGrid
              rows={rows}
              cols={cols}
              cells={cells}
              freeCenter={freeCenter}
              selected={selected}
              editing
              onCell={(i) => i !== centre && setSelected(i)}
            />

            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>{t('bingoFilled', { count: filled, total })}</span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  onClick={shuffle}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                >
                  <IoShuffleOutline className="h-4 w-4" />
                  {t('bingoShuffle')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCells(emptyCells(rows, cols))
                    setSelected(0)
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                >
                  <IoTrashOutline className="h-4 w-4" />
                  {t('bingoClearAll')}
                </button>
              </span>
            </div>

            {/* Jump to a square (handy on big boards) */}
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
                {t('bingoRow')}
                <input type="number" min={1} max={rows} value={jumpRow} onChange={(e) => jump(e.target.value, jumpCol)} className={inputCls} />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
                {t('bingoCol')}
                <input type="number" min={1} max={cols} value={jumpCol} onChange={(e) => jump(jumpRow, e.target.value)} className={inputCls} />
              </label>
              <button
                type="button"
                onClick={() => setSelected(nextEmpty(-1, cells))}
                className="h-10 flex-shrink-0 rounded-lg bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {t('bingoNextEmpty')}
              </button>
            </div>
          </div>

          {/* Right: fill the selected square, or many at once */}
          <div className="flex flex-col gap-3 md:border-l md:border-[var(--border-subtle)] md:pl-5">
            {selected === null ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
                {complete ? t('bingoAllFilled') : t('bingoPickSquare')}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--text)]">{t('bingoSquareRC', { r: Math.floor(selected / cols) + 1, c: (selected % cols) + 1 })}</p>
                {current && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface)] px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-[var(--text)]">{current.title}</span>
                    <button type="button" onClick={() => place(null)} className="flex-shrink-0 text-xs font-medium text-nonslightred hover:underline">
                      {t('bingoClearSquare')}
                    </button>
                  </div>
                )}

                {prompt && <p className="text-xs text-[var(--text-muted)]">{t('bingoPromptHelp')}</p>}

                {!prompt && (
                  <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
                    {(['catalog', 'text'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          mode === m ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {m === 'catalog' ? t('bingoFromCatalog') : t('bingoCustomText')}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'catalog' && !prompt ? (
                  <MediaPicker onPick={(item) => place(cellFromCatalog(item))} />
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const v = text.trim()
                      if (v) place({ kind: 'text', title: v.slice(0, BINGO_CELL_MAX) })
                    }}
                    className="flex flex-col gap-2"
                  >
                    <input
                      value={text}
                      maxLength={BINGO_CELL_MAX}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={prompt ? t('bingoPromptPlaceholder') : t('bingoTextPlaceholder')}
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      disabled={!text.trim()}
                      className="rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
                    >
                      {prompt ? t('bingoUsePrompt') : t('bingoUseText')}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Bulk add: the practical way to fill a big board */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => setBulkOpen((v) => !v)}
                aria-expanded={bulkOpen}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[var(--text)]"
              >
                {t('bingoBulk')}
                <span className="text-xs text-[var(--text-muted)]">{bulkOpen ? '−' : '+'}</span>
              </button>
              {bulkOpen && (
                <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">{t('bingoBulkHint')}</p>
                  <textarea
                    rows={6}
                    value={bulk}
                    onChange={(e) => setBulk(e.target.value)}
                    placeholder={t('bingoBulkPlaceholder')}
                    className="resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] p-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
                  />
                  <button
                    type="button"
                    onClick={addBulk}
                    disabled={bulkLines.length === 0}
                    className="rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
                  >
                    {t('bingoBulkAdd', { count: bulkLines.length })}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-3.5">
          <p className="min-w-0 truncate text-xs text-[var(--text-muted)]">{canSave ? '' : t('bingoNeedAll')}</p>
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!canSave}
              className="rounded-xl bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
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
