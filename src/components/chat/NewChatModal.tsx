'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IoClose } from 'react-icons/io5'
import { useLanguage } from '@/contexts/LanguageContext'
import { useChat } from '@/contexts/ChatContext'
import type { UserHit } from '@/services/userService'
import PeoplePicker from './PeoplePicker'

type Props = {
  meId: number
  onClose: () => void
  /** Called with the chat to open (the page puts it in the URL). */
  onOpen: (chatId: number, notice?: string) => void
}

// "New message": pick one person for a 1-on-1 chat, or name a group and pick
// several. Recipients' "who can message me" settings are enforced by the server.
export default function NewChatModal({ meId, onClose, onOpen }: Props) {
  const { t } = useLanguage()
  const { startDirect, createGroup } = useChat()
  const [tab, setTab] = useState<'direct' | 'group'>('direct')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [members, setMembers] = useState<UserHit[]>([])
  const [creating, setCreating] = useState(false)

  if (typeof document === 'undefined') return null

  const pickDirect = async (u: UserHit) => {
    setError(null)
    setBusyId(u.id)
    const r = await startDirect(u.id)
    setBusyId(null)
    if (r.ok) onOpen(r.data.id)
    else setError(r.code === 'messages_not_allowed' ? t('chatNotAllowed') : r.error)
  }

  const toggle = (u: UserHit) =>
    setMembers((cur) => (cur.some((m) => m.id === u.id) ? cur.filter((m) => m.id !== u.id) : [...cur, u]))

  const create = async () => {
    if (!title.trim() || creating) return
    setError(null)
    setCreating(true)
    const r = await createGroup(title.trim(), members.map((m) => m.id))
    setCreating(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    const skipped = r.data.skipped_user_ids?.length ?? 0
    onOpen(r.data.id, skipped ? t('chatSkipped', { n: skipped }) : undefined)
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-start justify-center bg-[var(--overlay)] p-4 pt-[10vh] backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('chatNew')}
        className="animate-fade-up w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--container)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">{t('chatNew')}</h2>
          <button onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 inline-flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          {(['direct', 'group'] as const).map((k) => (
            <button
              key={k}
              onClick={() => { setTab(k); setError(null) }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {k === 'direct' ? t('chatDirectTab') : t('chatGroupTab')}
            </button>
          ))}
        </div>

        {tab === 'group' && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder={t('chatGroupName')}
            aria-label={t('chatGroupName')}
            className="mb-3 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--placeholder)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        )}

        {tab === 'direct' ? (
          <PeoplePicker meId={meId} onPick={(u) => void pickDirect(u)} busyId={busyId} />
        ) : (
          <PeoplePicker meId={meId} selected={members} onToggle={toggle} />
        )}

        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}

        {tab === 'group' && (
          <button
            onClick={() => void create()}
            disabled={!title.trim() || creating}
            className="mt-4 w-full rounded-xl bg-nonsprimary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
          >
            {creating ? t('saving') : t('chatCreateGroup')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
