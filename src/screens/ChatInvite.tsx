'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@/lib/router'
import Layout from '../components/layout/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useLoginModal } from '../contexts/LoginModalContext'
import { chatApi, type Chat, type InvitePreview } from '../services/chatService'
import { ChatAvatar, PersonAvatar } from '../components/chat/chatFormat'

// /messages/invite/<token> — a group invite link. Shows which group it is,
// then joins on an explicit click (never on page load: a link someone drops in
// a comment must not silently add you to a group). Signed-out visitors get the
// login modal; the page stays put, so they can join right after signing in.
export default function ChatInvite() {
  const { token = '' } = useParams<{ token: string }>()
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuth()
  const { openLogin } = useLoginModal()
  const { upsertChat } = useChat()
  const navigate = useNavigate()

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [failed, setFailed] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    chatApi.previewInvite(token).then((r) => {
      if (cancelled) return
      if (r.ok) setPreview(r.data)
      else setFailed(true)
    })
    return () => { cancelled = true }
    // Re-fetch after signing in: is_member and the member list depend on who asks.
  }, [token, authLoading, user?.id])

  const goToChat = (id: number) => navigate(`/messages?chat=${id}`, { replace: true })

  const join = async () => {
    if (!user) {
      openLogin('messages')
      return
    }
    if (!preview || joining) return
    if (preview.is_member) {
      goToChat(preview.id)
      return
    }
    setJoining(true)
    setError(null)
    const r = await chatApi.joinInvite(token)
    setJoining(false)
    if (r.ok) {
      upsertChat(r.data)
      goToChat(r.data.id)
    } else {
      setError(r.status === 404 ? t('chatInviteInvalid') : r.error)
    }
  }

  const asChat: Chat | null = preview
    ? {
        id: preview.id,
        type: 'group',
        title: preview.title,
        avatar_url: preview.avatar_url,
        created_at: 0,
        updated_at: 0,
        participants: preview.participants,
        unread_count: 0,
      }
    : null

  return (
    <Layout>
      <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--container)] p-6 text-center shadow-xl">
        {failed ? (
          <>
            <h1 className="text-lg font-semibold text-[var(--text)]">{t('chatInviteInvalidTitle')}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t('chatInviteInvalid')}</p>
            <button
              onClick={() => navigate(user ? '/messages' : '/')}
              className="mt-5 w-full rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
            >
              {user ? t('chatTitle') : t('home')}
            </button>
          </>
        ) : !preview || !asChat ? (
          <div className="flex flex-col items-center gap-3 py-4" aria-busy="true">
            <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--surface)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface)]" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{t('chatInviteHeading')}</p>
            <div className="mt-4 flex justify-center">
              <ChatAvatar chat={asChat} meId={user?.id ?? 0} size={72} />
            </div>
            <h1 className="mt-3 break-words text-xl font-semibold text-[var(--text)]">{preview.title}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('chatMembers', { n: preview.member_count })}</p>

            {preview.participants.length > 0 && (
              <div className="mt-3 flex justify-center -space-x-2">
                {preview.participants.slice(0, 6).map((p) => (
                  <span key={p.user_id} className="rounded-full ring-2 ring-[var(--container)]">
                    <PersonAvatar p={p} size={28} />
                  </span>
                ))}
              </div>
            )}

            {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

            <button
              onClick={() => void join()}
              disabled={joining}
              className="mt-6 w-full rounded-xl bg-nonsprimary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nonsprimaryfocus disabled:opacity-50"
            >
              {!user ? t('chatInviteSignIn') : preview.is_member ? t('chatInviteOpen') : joining ? t('saving') : t('chatInviteJoin')}
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}
