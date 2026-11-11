'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoShuffleOutline, IoStar, IoTrashOutline } from 'react-icons/io5'
import MediaPicker from '@/components/media/MediaPicker'
import BingoGrid from './BingoGrid'
import {
  BINGO_CELL_MAX,
  BINGO_CELLS,
  BINGO_CENTER,
  BINGO_DESC_MAX,
  BINGO_TITLE_MAX,
  emptyCells,
  filledCount,
  newBingoId,
  type Bingo,
  type BingoCell,
} from '@/lib/bingo'
import type { CatalogItem } from '@/services/catalogService'
import { useLanguage } from '@/contexts/LanguageContext'

type Props = {
  /** Existing board to edit, or a template to start from; omit for a blank one. */
  initial?: Bingo | null
  /** True when `initial` is the user's own board being edited in place (otherwise a new board is made). */
  isEdit?: boolean
  /** Name shown as the board's author. */
  author: string
  onClose: () => void
  onSave: (b: Bingo) => void
}

const inputCls =
  'h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]'

function cellFromCatalog(item: CatalogItem): BingoCell {
  return {
    kind: 'media',
    title: item.title.slice(0, BINGO_CELL_MAX),
    type: item.type,
    coverUrl: item.coverUrl || undefined,
    credit: ((item.type === 'book' ? item.author : item.director || item.author) || undefined)?.slice(0, BINGO_CELL_MAX),
    year: item.year || undefined,
  }
}

// Create / edit a bingo. Mounted only while open, so the draft state simply
// initialises from `initial` — no syncing effects.
export default function BingoEditor({ initial, isEdit = false, author, onClose, onSave }: Props) {
  const { t } = useLanguage()
  const editingExisting = isEdit && !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [freeCenter, setFreeCenter] = useState(initial?.freeCenter ?? true)
  const [cells, setCells] = useState<(BingoCell | null)[]>(initial?.cells ?? emptyCells())
  const [selected, setSelected] = useState<number | null>(() => {
    const free = initial?.freeCenter ?? true
    const first = (initial?.cells ?? emptyCells()).findIndex((c, i) => !c && !(free && i === BINGO_CENTER))
    return first === -1 ? null : first
  })
  const [mode, setMode] = useState<'catalog' | 'text'>('catalog')
  const [text, setText] = useState('')

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

  const filled = filledCount(cells, freeCenter)
  const needed = BINGO_CELLS
  const complete = filled === needed
  const canSave = title.trim().length > 0 && complete

  const nextEmpty = (from: number, next: (BingoCell | null)[]) => {
    for (let step = 1; step <= BINGO_CELLS; step++) {
      const i = (from + step) % BINGO_CELLS
      if (!next[i] && !(freeCenter && i === BINGO_CENTER)) return i
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
    const idx = cells.map((_, i) => i).filter((i) => !(freeCenter && i === BINGO_CENTER))
    const items = idx.map((i) => cells[i])
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    const next = [...cells]
    idx.forEach((slot, k) => (next[slot] = items[k]))
    setCells(next)
  }

  const submit = () => {
    if (!canSave) return
    onSave({
      id: editingExisting && initial ? initial.id : newBingoId(),
      title: title.trim().slice(0, BINGO_TITLE_MAX),
      description: description.trim().slice(0, BINGO_DESC_MAX),
      author,
      freeCenter,
      // A free centre never holds a prompt of its own.
      cells: cells.map((c, i) => (freeCenter && i === BINGO_CENTER ? null : c)),
      createdAt: editingExisting && initial ? initial.createdAt : Date.now(),
    })
  }

  const current = selected !== null ? cells[selected] : null

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

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: details + the board */}
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text)]">
              {t('title')}
              <input
                value={title}
                maxLength={BINGO_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('bingoTitlePlaceholder')}
                className={inputCls}
              />
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

            <button
              type="button"
              role="switch"
              aria-checked={freeCenter}
              onClick={() => {
                setFreeCenter((v) => !v)
                setSelected(null)
              }}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-3 text-left"
            >
              <span className="flex items-center gap-2.5">
                <IoStar className="h-4 w-4 text-nonsprimary" />
                <span>
                  <span className="block text-sm font-medium text-[var(--text)]">{t('bingoFreeCenter')}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{t('bingoFreeCenterHint')}</span>
                </span>
              </span>
              <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${freeCenter ? 'bg-nonsprimary' : 'bg-[var(--surface-active)]'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${freeCenter ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>

            <BingoGrid cells={cells} freeCenter={freeCenter} selected={selected} editing onCell={(i) => !(freeCenter && i === BINGO_CENTER) && setSelected(i)} />

            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>{t('bingoFilled', { count: filled, total: needed })}</span>
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
                    setCells(emptyCells())
                    setSelected(0)
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                >
                  <IoTrashOutline className="h-4 w-4" />
                  {t('bingoClearAll')}
                </button>
              </span>
            </div>
          </div>

          {/* Right: fill the selected square */}
          <div className="flex flex-col gap-3 md:border-l md:border-[var(--border-subtle)] md:pl-5">
            {selected === null ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
                {complete ? t('bingoAllFilled') : t('bingoPickSquare')}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--text)]">{t('bingoSquareN', { n: selected + 1 })}</p>
                {current && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface)] px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-[var(--text)]">{current.title}</span>
                    <button
                      type="button"
                      onClick={() => place(null)}
                      className="flex-shrink-0 text-xs font-medium text-nonslightred hover:underline"
                    >
                      {t('bingoClearSquare')}
                    </button>
                  </div>
                )}

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

                {mode === 'catalog' ? (
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
                      placeholder={t('bingoTextPlaceholder')}
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      disabled={!text.trim()}
                      className="rounded-lg bg-nonsprimary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
                    >
                      {t('bingoUseText')}
                    </button>
                  </form>
                )}
              </>
            )}
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
