'use client'

import { useState } from 'react'
import { IoLogOutOutline } from 'react-icons/io5'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

// "Are you sure you want to log out?" for every sign-out button (account menu,
// mobile menu, settings). `ask()` opens the dialog; render `modal` anywhere in
// the caller — it portals to <body>, so keep it outside menus that close on
// click, and outside overlays whose onClick would also fire on bubbling.
export function useLogoutConfirm() {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await logout()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  const modal = open ? (
    <ConfirmModal
      title={t('logoutConfirmTitle')}
      message={t('logoutConfirmText')}
      icon={<IoLogOutOutline className="h-5 w-5" />}
      confirmText={busy ? t('loggingOut') : t('logout')}
      cancelText={t('cancel')}
      variant="danger"
      busy={busy}
      onConfirm={confirm}
      onCancel={() => { if (!busy) setOpen(false) }}
    />
  ) : null

  return { ask: () => setOpen(true), modal }
}
