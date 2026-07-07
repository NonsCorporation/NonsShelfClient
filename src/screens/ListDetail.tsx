'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from '@/lib/router'
import { IoLayersOutline, IoTrash, IoClose } from 'react-icons/io5'
import Layout from '../components/layout/Layout'
import ConfirmModal from '../components/ConfirmModal'
import { listService } from '../services/listService'
import { mediaPath } from '../lib/paths'
import { useLanguage } from '../contexts/LanguageContext'
import { useLists } from '../contexts/ListContext'
import type { CuratedListDetail } from '../types'

// A single curated list (/library/lists/<id>): editable title + description,
// plus each item's per-item note — editable inline, Goodreads "Listopia" style.
// Adding an item to a list happens from the item's own controls elsewhere in
// the library (mirrors how Collections are added to); this page manages the
// list itself and the notes/removal of items already on it.
export default function ListDetailScreen() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const { updateList: updateListInContext, deleteList: deleteListInContext } = useLists()

  const [data, setData] = useState<CuratedListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(() => {
    return listService.getList(Number(id)).then((d) => {
      setData(d)
      setNotFound(!d)
      setLoading(false)
    })
  }, [id])

  useEffect(() => { setLoading(true); load() }, [load])

  // ── Title / description — editable inline, committed on blur. ──────────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    if (data) { setTitle(data.title); setDescription(data.description ?? '') }
  }, [data])
  const titleRef = useRef<HTMLInputElement>(null)

  async function commitTitle() {
    if (!data) return
    const trimmed = title.trim()
    if (!trimmed) { setTitle(data.title); return }
    if (trimmed === data.title) return
    await updateListInContext(data.id, trimmed, data.description)
    setData((d) => (d ? { ...d, title: trimmed } : d))
  }

  async function commitDescription() {
    if (!data) return
    if (description === (data.description ?? '')) return
    await updateListInContext(data.id, data.title, description)
    setData((d) => (d ? { ...d, description } : d))
  }

  // ── Per-item note — editable inline per row, committed on blur. ────────────
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({})
  function noteFor(mediaId: number, fallback: string) {
    return noteDrafts[mediaId] ?? fallback
  }
  async function commitNote(mediaId: number, original: string) {
    if (!data) return
    const next = (noteDrafts[mediaId] ?? original).trim()
    if (next === original) return
    await listService.updateListItem(data.id, mediaId, next)
    setData((d) => d ? { ...d, items: d.items.map((it) => it.media_id === mediaId ? { ...it, description: next } : it) } : d)
  }

  async function removeItem(mediaId: number) {
    if (!data) return
    await listService.removeListItem(data.id, mediaId)
    setData((d) => d ? { ...d, items: d.items.filter((it) => it.media_id !== mediaId), count: d.count - 1 } : d)
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  async function handleDelete() {
    if (!data) return
    setDeleting(true)
    try {
      await deleteListInContext(data.id)
      navigate('/library')
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div></Layout>
  }
  if (notFound || !data) {
    return <Layout><div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound')}</div></Layout>
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)]">
          <IoLayersOutline className="h-5 w-5 text-nonsprimary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            List
          </p>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') titleRef.current?.blur() }}
            maxLength={150}
            className="mt-0.5 w-full min-w-0 -ml-2 rounded-md bg-transparent px-2 py-0.5 text-2xl font-bold tracking-tight text-[var(--text)] outline-none focus:bg-[var(--surface)]"
          />
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {data.count} item{data.count !== 1 ? 's' : ''}
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="Add a description…"
            rows={2}
            maxLength={4000}
            className="mt-3 w-full max-w-2xl resize-none rounded-lg bg-transparent px-2 py-1 -ml-2 text-sm leading-6 text-[var(--text-muted)] outline-none focus:bg-[var(--surface)]"
          />
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          title="Delete list"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-red-400"
        >
          <IoTrash className="h-4 w-4" />
        </button>
      </div>

      {data.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">
          {t('noEntriesYet')}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {data.items.map((it) => (
            <li
              key={it.media_id}
              className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-3"
            >
              {it.media && (
                <Link
                  to={mediaPath({ type: it.media.type, uuid: it.media.uuid, id: String(it.media.id) })}
                  className="flex flex-shrink-0"
                >
                  <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--container-2)]">
                    {it.media.cover_url && (
                      <img src={it.media.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
              )}
              <div className="min-w-0 flex-1">
                {it.media ? (
                  <Link to={mediaPath({ type: it.media.type, uuid: it.media.uuid, id: String(it.media.id) })}>
                    <p className="truncate font-semibold text-[var(--text)] hover:underline">{it.media.title}</p>
                    <p className="truncate text-sm text-[var(--text-muted)]">
                      {[it.media.author || it.media.director, it.media.year || undefined].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                ) : (
                  <p className="text-sm italic text-[var(--text-muted)]">{t('itemNotFound')}</p>
                )}
                <textarea
                  value={noteFor(it.media_id, it.description ?? '')}
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [it.media_id]: e.target.value }))}
                  onBlur={() => commitNote(it.media_id, it.description ?? '')}
                  placeholder="Why is this on the list?"
                  rows={1}
                  maxLength={1000}
                  className="mt-2 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 -ml-0.5 text-xs leading-5 text-[var(--text-muted)] outline-none focus:bg-[var(--surface-hover)] focus:text-[var(--text)]"
                />
              </div>
              <button
                onClick={() => removeItem(it.media_id)}
                title="Remove"
                className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-red-400"
              >
                <IoClose className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${data.title}"?`}
          message="Items stay in your library — this only removes the list itself."
          confirmText={deleting ? t('deleting') : t('delete')}
          cancelText={t('cancel')}
          variant="danger"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Layout>
  )
}
