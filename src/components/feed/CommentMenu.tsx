'use client'

import { IoArrowUndoOutline, IoCopyOutline, IoFlagOutline, IoTrashOutline } from 'react-icons/io5'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/contexts/LanguageContext'

// The three-dots menu on a comment: copy its text, reply, report (not built yet,
// so it just says "soon"), and — on your own comments — delete.
export default function CommentMenu({
  body,
  onReply,
  onDelete,
  className = '',
}: {
  body: string
  onReply: () => void
  /** Only passed for the viewer's own comments. */
  onDelete?: () => void
  className?: string
}) {
  const { t } = useLanguage()
  const toast = useToast()

  const copy = () => {
    navigator.clipboard
      ?.writeText(body)
      .then(() => toast.show(t('copied')))
      .catch(() => {})
  }

  return (
    <>
      <DropdownMenu
        className={className}
        buttonClassName="!p-0.5"
        items={[
          { label: t('copy'), icon: <IoCopyOutline className="h-4 w-4" />, onClick: copy },
          { label: t('reply'), icon: <IoArrowUndoOutline className="h-4 w-4" />, onClick: onReply },
          { label: t('commentReport'), icon: <IoFlagOutline className="h-4 w-4" />, onClick: () => toast.show(t('soon')) },
          ...(onDelete ? [{ label: t('delete'), icon: <IoTrashOutline className="h-4 w-4" />, onClick: onDelete, danger: true, divider: true }] : []),
        ]}
      />
      {toast.node}
    </>
  )
}
