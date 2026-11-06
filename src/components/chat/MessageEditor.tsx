'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Extension } from '@tiptap/core'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BsTypeBold, BsTypeItalic, BsEyeSlash, BsBlockquoteLeft } from 'react-icons/bs'
import { reviewExtensions } from '@/components/review/reviewExtensions'
import { useLanguage } from '@/contexts/LanguageContext'

export type MessageEditorHandle = { focus: () => void }

type Props = {
  /** Current draft as the editor's HTML ('' when empty). */
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Enter sends (Shift+Enter = new line). False on touch keyboards, where
   *  Enter is a new line and the send button sends. */
  submitOnEnter: boolean
  onSubmit: () => void
  /** Escape: return true if it was handled (e.g. cancelled a reply/edit). */
  onEscape: () => boolean
}

function FormatButton({ active, title, onToggle, children }: { active: boolean; title: string; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // mousedown + preventDefault keeps the selection (and the keyboard up).
      onMouseDown={(e) => { e.preventDefault(); onToggle() }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-nonsprimary/15 text-nonsprimary' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  )
}

function FormatBar({ editor }: { editor: Editor }) {
  const { t } = useLanguage()
  return (
    <div className="absolute bottom-full left-2 z-10 mb-1.5 flex gap-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--container)] p-1 shadow-lg">
      <FormatButton title={t('fmtBold')} active={editor.isActive('bold')} onToggle={() => editor.chain().focus().toggleBold().run()}>
        <BsTypeBold className="h-4 w-4" />
      </FormatButton>
      <FormatButton title={t('fmtItalic')} active={editor.isActive('italic')} onToggle={() => editor.chain().focus().toggleItalic().run()}>
        <BsTypeItalic className="h-4 w-4" />
      </FormatButton>
      <FormatButton title={t('fmtSpoiler')} active={editor.isActive('spoiler')} onToggle={() => editor.chain().focus().toggleSpoiler().run()}>
        <BsEyeSlash className="h-4 w-4" />
      </FormatButton>
      <FormatButton title={t('fmtQuote')} active={editor.isActive('blockquote')} onToggle={() => editor.chain().focus().toggleBlockquote().run()}>
        <BsBlockquoteLeft className="h-4 w-4" />
      </FormatButton>
    </div>
  )
}

// The chat composer: the review editor (bold, italic, spoiler, quote) in a
// message-sized box. A small format bar floats above it while it has focus.
const MessageEditor = forwardRef<MessageEditorHandle, Props>(function MessageEditor(
  { value, onChange, placeholder, submitOnEnter, onSubmit, onEscape },
  ref,
) {
  // The editor is created once; keep the latest callbacks in refs.
  const latest = useRef({ onChange, submitOnEnter, onSubmit, onEscape })
  useEffect(() => { latest.current = { onChange, submitOnEnter, onSubmit, onEscape } })

  const [focused, setFocused] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...reviewExtensions(placeholder),
      Extension.create({
        name: 'messageKeys',
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (!latest.current.submitOnEnter) return false
              latest.current.onSubmit()
              return true
            },
            Escape: () => latest.current.onEscape(),
          }
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'review-editor max-h-40 min-h-[36px] overflow-y-auto py-2 text-sm leading-5 text-[var(--text)] outline-none',
        'aria-label': placeholder ?? '',
      },
    },
    onUpdate: ({ editor }) => latest.current.onChange(editor.isEmpty ? '' : editor.getHTML()),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })

  // The draft is reset from outside (sent, cancelled, switched to editing).
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) editor.commands.setContent(value || '', { emitUpdate: false })
  }, [value, editor])

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus('end') }), [editor])

  if (!editor) return <div className="min-h-[36px] flex-1" />

  return (
    <div className="relative min-w-0 flex-1" onClick={() => editor.commands.focus()}>
      {focused && <FormatBar editor={editor} />}
      <EditorContent editor={editor} className="cursor-text" />
    </div>
  )
})

export default MessageEditor
