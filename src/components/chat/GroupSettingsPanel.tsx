'use client'

import { useEffect, useState } from 'react'
import { useScrollLock } from '@/lib/useScrollLock'
import { createPortal } from 'react-dom'
import { IoCheckmark, IoClose, IoCopyOutline, IoLinkOutline } from 'react-icons/io5'
import { Link } from '@/lib/router'
import { useLanguage } from '@/contexts/LanguageContext'
import { useChat } from '@/contexts/ChatContext'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { userPath } from '@/lib/paths'
import { chatApi, type Chat, type ChatInvite } from '@/services/chatService'
import type { UserHit } from '@/services/userService'
import PeoplePicker from './PeoplePicker'
import { ChatAvatar, PersonAvatar } from './chatFormat'

type Props = {
  chat: Chat
  meId: number
  onClose: () => void
  /** After leaving / deleting: go back to the list. */
  onGone: () => void
}

// Group settings: rename (admins), members (admins remove; anyone adds), the
// invite link (anyone in the group), leave, delete (admins). Only for groups —
// the server refuses member/invite changes on 1-on-1 chats.
export default function GroupSettingsPanel({ chat, meId, onClose, onGone }: Props) {
  const { t } = useLanguage()
  const { upsertChat, forgetChat } = useChat()
  const me = chat.participants.find((p) => p.user_id === meId)
  const isAdmin = me?.role === 'admin'

  const [title, setTitle] = useState(chat.title)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toAdd, setToAdd] = useState<UserHit[]>([])
  const [invite, setInvite] = useState<ChatInvite | null>(null)
  const [inviteLoaded, setInviteLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    chatApi.getInvite(chat.id).then((r) => {
      if (cancelled) return
      if (r.ok) setInvite(r.data.invite)
      setInviteLoaded(true)
    })
    return () => { cancelled = true }
  }, [chat.id])

  useScrollLock(true)
  if (typeof document === 'undefined') return null

  const inviteUrl = invite ? `${window.location.origin}/messages/invite/${invite.token}` : ''

  const run = async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, then?: (d: T) => void) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await fn()
    setBusy(false)
    if (r.ok) then?.(r.data)
    else setError(r.error)
  }

  const saveTitle = () => {
    const v = title.trim()
    if (!v || v === chat.title) return
    void run(() => chatApi.renameGroup(chat.id, v), (c) => upsertChat(c))
  }

  const addMembers = () =>
    void run(() => chatApi.addMembers(chat.id, toAdd.map((u) => u.id)), (c) => {
      upsertChat(c)
      setAdding(false)
      setToAdd([])
      const skipped = c.skipped_user_ids?.length ?? 0
      setNotice(skipped ? t('chatSkipped', { n: skipped }) : null)
    })

  const removeMember = (userId: number) =>
    void run(() => chatApi.removeMember(chat.id, userId), () =>
      upsertChat({ ...chat, participants: chat.participants.filter((p) => p.user_id !== userId) }),
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the link is visible to copy by hand */
    }
  }

  const doConfirm = () => {
    const kind = confirm
    setConfirm(null)
    if (kind === 'leave') void run(() => chatApi.leaveChat(chat.id), () => { forgetChat(chat.id); onGone() })
    if (kind === 'delete') void run(() => chatApi.deleteChat(chat.id), () => { forgetChat(chat.id); onGone() })
  }

  const section = 'border-t border-[var(--border-subtle)] pt-4 mt-4'

  return createPortal(
    <>
    <div onClick={onClose} className="fixed inset-0 z-[80] flex justify-end bg-[var(--overlay)] backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('chatGroupSettings')}
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--container)] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">{t('chatGroupSettings')}</h2>
          <button onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ChatAvatar chat={chat} meId={meId} size={52} />
          {isAdmin ? (
            <div className="flex flex-1 gap-2">
              <input
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                aria-label={t('chatGroupName')}
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--input)] px-3 text-sm text-[var(--text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)]"
              />
              <button
                onClick={saveTitle}
                disabled={busy || !title.trim() || title.trim() === chat.title}
                className="rounded-xl bg-nonsprimary px-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {t('save')}
              </button>
            </div>
          ) : (
            <span className="text-base font-semibold text-[var(--text)]">{chat.title}</span>
          )}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mt-3 text-sm text-[var(--text-muted)]">{notice}</p>}

        {/* members */}
        <div className={section}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">{t('chatMembers', { n: chat.participants.length })}</h3>
            <button onClick={() => setAdding((v) => !v)} className="text-sm font-medium text-nonsprimary hover:underline">
              {adding ? t('cancel') : t('chatAddMembers')}
            </button>
          </div>
          {adding && (
            <div className="mb-3 rounded-xl border border-[var(--border-subtle)] p-3">
              <PeoplePicker
                meId={meId}
                selected={toAdd}
                onToggle={(u) => setToAdd((cur) => (cur.some((x) => x.id === u.id) ? cur.filter((x) => x.id !== u.id) : [...cur, u]))}
                excludeIds={chat.participants.map((p) => p.user_id)}
              />
              <button
                onClick={addMembers}
                disabled={busy || toAdd.length === 0}
                className="mt-3 w-full rounded-xl bg-nonsprimary py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t('chatAdd')}
              </button>
            </div>
          )}
          <ul className="space-y-1">
            {chat.participants.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <PersonAvatar p={p} size={34} />
                <Link to={userPath(p.username)} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text)] hover:underline">
                    {p.user_id === meId ? t('chatYou') : p.name || p.username}
                  </span>
                  <span className="block truncate font-mono text-xs text-[var(--text-muted)]">@{p.username}</span>
                </Link>
                {p.role === 'admin' && <span className="text-[11px] text-[var(--text-muted)]">{t('chatAdmin')}</span>}
                {isAdmin && p.user_id !== meId && (
                  <button
                    onClick={() => removeMember(p.user_id)}
                    disabled={busy}
                    className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-red-400"
                  >
                    {t('chatRemoveMember')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* invite link */}
        <div className={section}>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
            <IoLinkOutline className="h-4 w-4" /> {t('chatInviteLink')}
          </h3>
          <p className="mb-2 text-xs text-[var(--text-muted)]">{t('chatInviteHint')}</p>
          {!inviteLoaded ? null : invite ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 select-all truncate text-xs text-[var(--text-muted)]">{inviteUrl}</span>
                <button onClick={() => void copy()} className="flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-nonsprimary">
                  {copied ? <IoCheckmark className="h-3.5 w-3.5" /> : <IoCopyOutline className="h-3.5 w-3.5" />}
                  {copied ? t('chatInviteCopied') : t('chatInviteCopy')}
                </button>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <button onClick={() => void run(() => chatApi.createInvite(chat.id), (d) => setInvite(d.invite))} className="text-nonsprimary hover:underline">
                  {t('chatInviteNew')}
                </button>
                <button onClick={() => void run(() => chatApi.revokeInvite(chat.id), () => setInvite(null))} className="text-[var(--text-muted)] hover:text-red-400">
                  {t('chatInviteRevoke')}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => void run(() => chatApi.createInvite(chat.id), (d) => setInvite(d.invite))}
              disabled={busy}
              className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              {t('chatInviteCreate')}
            </button>
          )}
        </div>

        {/* leave / delete */}
        <div className={`${section} mt-auto flex flex-col gap-2`}>
          <button onClick={() => setConfirm('leave')} className="rounded-xl px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-red-500/10">
            {t('chatLeave')}
          </button>
          {isAdmin && (
            <button onClick={() => setConfirm('delete')} className="rounded-xl px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-red-500/10">
              {t('chatDeleteGroup')}
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Outside the panel's backdrop, so its clicks never bubble into onClose. */}
    {confirm && (
        <ConfirmModal
          title={confirm === 'leave' ? t('chatLeave') : t('chatDeleteGroup')}
          message={confirm === 'leave' ? t('chatLeaveConfirm') : t('chatDeleteChatConfirm')}
          confirmText={confirm === 'leave' ? t('chatLeave') : t('chatDelete')}
          cancelText={t('cancel')}
          variant="danger"
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>,
    document.body,
  )
}
