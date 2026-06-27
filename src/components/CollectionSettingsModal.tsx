'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IoClose, IoCheckmark } from 'react-icons/io5'
import { useCollections } from '../contexts/CollectionContext'
import { collectionService } from '../services/collectionService'
import type { Collection, MediaItem } from '../types'

interface Props {
  collection: Collection
  allCollections: Collection[]
  /** All shelf items — the modal filters by this collection internally. */
  items: MediaItem[]
  onClose: () => void
  /** Called after any successful mutation so the parent can refresh its data. */
  onDone: () => void
}

export default function CollectionSettingsModal({
  collection,
  allCollections,
  items,
  onClose,
  onDone,
}: Props) {
  const { renameCollection, deleteCollection, createCollection, refresh } = useCollections()

  // ── Rename ──────────────────────────────────────────────────────────────────
  const [newName, setNewName] = useState(collection.name)
  const [renameError, setRenameError] = useState('')

  // ── Move all items ───────────────────────────────────────────────────────────
  const [moveMode, setMoveMode] = useState<'existing' | 'new'>('existing')
  const [targetColId, setTargetColId] = useState<number | null>(null)
  const [newColName, setNewColName] = useState('')
  const [removeAfterMove, setRemoveAfterMove] = useState(true)
  const [deleteAfterMove, setDeleteAfterMove] = useState(false)

  // ── Shared ───────────────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const others = allCollections.filter((c) => c.id !== collection.id)
  const inCollection = items.filter((it) => it.collectionIds?.includes(collection.id))
  const itemCount = inCollection.length

  // Default target to the first other collection.
  useEffect(() => {
    if (others.length > 0 && targetColId === null) {
      setTargetColId(others[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others.length])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleRename() {
    const name = newName.trim()
    if (!name || name === collection.name) return
    setRenameError('')
    setBusy(true)
    try {
      await renameCollection(collection.id, name)
      onDone()
      onClose()
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Failed to rename')
    } finally {
      setBusy(false)
    }
  }

  async function handleMoveAll() {
    setMoveError('')
    setBusy(true)
    try {
      let targetId: number | null = null

      if (itemCount > 0) {
        if (moveMode === 'new') {
          const name = newColName.trim()
          if (!name) { setMoveError('Enter a name for the new collection'); setBusy(false); return }
          const col = await createCollection(name)
          targetId = col.id
        } else {
          if (!targetColId) { setMoveError('Select a target collection'); setBusy(false); return }
          targetId = targetColId
        }

        await Promise.all(
          inCollection.map((it) => {
            const current = it.collectionIds ?? []
            const withTarget = Array.from(new Set([...current, targetId!]))
            const final = removeAfterMove
              ? withTarget.filter((id) => id !== collection.id)
              : withTarget
            return collectionService.setItemCollections(it.id, final)
          }),
        )
      }

      if (removeAfterMove && deleteAfterMove) {
        await deleteCollection(collection.id)
      }

      await refresh()
      onDone()
      onClose()
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Operation failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteCollection(collection.id)
      onDone()
      onClose()
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Delete failed')
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  const canMove =
    !busy &&
    (itemCount === 0 ||
      (moveMode === 'existing' && (targetColId !== null || others.length === 0)) ||
      (moveMode === 'new' && newColName.trim().length > 0))

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay)] backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--container)] shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-[var(--text)]">Collection settings</h2>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {collection.name}
              {itemCount > 0 && ` · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          >
            <IoClose className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">

          {/* ── Rename ── */}
          <section className="px-5 py-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Rename
            </p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setRenameError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
                maxLength={80}
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
              <button
                onClick={handleRename}
                disabled={busy || !newName.trim() || newName.trim() === collection.name}
                className="h-10 rounded-xl bg-nonsprimary px-4 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
              >
                Save
              </button>
            </div>
            {renameError && <p className="mt-2 text-xs text-red-400">{renameError}</p>}
          </section>

          {/* ── Move all items ── */}
          <section className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Move all items
              </p>
              {itemCount > 0 && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                  {itemCount}
                </span>
              )}
            </div>

            {/* Mode toggle */}
            <div className="mb-3 flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
              {(['existing', 'new'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMoveMode(mode)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                    moveMode === mode
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {mode === 'existing' ? 'To existing' : 'To new collection'}
                </button>
              ))}
            </div>

            {/* Target picker */}
            {moveMode === 'existing' ? (
              others.length > 0 ? (
                <div className="mb-3 max-h-44 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
                  {others.map((col, i) => (
                    <button
                      key={col.id}
                      onClick={() => { setTargetColId(col.id); setMoveError('') }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                        i === 0 ? 'rounded-t-xl' : ''
                      } ${i === others.length - 1 ? 'rounded-b-xl' : ''} ${
                        targetColId === col.id
                          ? 'bg-[var(--surface-active)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                          targetColId === col.id ? 'border-nonsprimary bg-nonsprimary' : 'border-[var(--border)]'
                        }`}
                      >
                        {targetColId === col.id && <IoCheckmark className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{col.name}</span>
                      <span className="flex-shrink-0 text-xs opacity-50">{col.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mb-3 rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center">
                  <p className="text-sm text-[var(--text-muted)]">No other collections yet.</p>
                  <button
                    onClick={() => setMoveMode('new')}
                    className="mt-1 text-xs text-nonsprimaryfocus hover:underline"
                  >
                    Create a new one
                  </button>
                </div>
              )
            ) : (
              <input
                value={newColName}
                onChange={(e) => { setNewColName(e.target.value); setMoveError('') }}
                placeholder="New collection name…"
                maxLength={80}
                className="mb-3 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
            )}

            {/* Options */}
            <div className="mb-3 flex flex-col gap-2">
              <Checkbox
                checked={removeAfterMove}
                onChange={(v) => { setRemoveAfterMove(v); if (!v) setDeleteAfterMove(false) }}
                label={
                  <>Remove from <span className="font-medium">"{collection.name}"</span> after moving</>
                }
              />
              <Checkbox
                checked={deleteAfterMove && removeAfterMove}
                onChange={setDeleteAfterMove}
                disabled={!removeAfterMove}
                label={
                  <>Delete <span className="font-medium">"{collection.name}"</span> after moving</>
                }
              />
            </div>

            {moveError && <p className="mb-2 text-xs text-red-400">{moveError}</p>}

            <button
              onClick={handleMoveAll}
              disabled={!canMove}
              className="w-full rounded-xl bg-nonsprimary py-3 text-sm font-medium text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-40"
            >
              {busy
                ? 'Moving…'
                : itemCount === 0
                  ? 'Nothing to move'
                  : `Move ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            </button>
          </section>

          {/* ── Delete ── */}
          <section className="px-5 py-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Danger zone
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
              >
                Delete collection
              </button>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="mb-1 font-medium text-[var(--text)]">Delete "{collection.name}"?</p>
                <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">
                  Items stay in your library — they just won't be in this collection anymore.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busy ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>,
    document.body,
  )
}

function Checkbox({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-3 text-left transition-colors ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-[var(--surface-hover)]'}`}
    >
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? 'border-nonsprimary bg-nonsprimary' : 'border-[var(--border)] bg-[var(--input)]'
        }`}
      >
        {checked && <IoCheckmark className="h-3 w-3 text-white" />}
      </span>
      <span className="text-sm text-[var(--text)]">{label}</span>
    </button>
  )
}
