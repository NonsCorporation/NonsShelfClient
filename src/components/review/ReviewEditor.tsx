'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BsTypeBold, BsTypeItalic, BsEyeSlash, BsBlockquoteLeft } from 'react-icons/bs'
import { reviewExtensions } from './reviewExtensions'

export interface ReviewEditorProps {
  /** Current review content as HTML. */
  value: string
  /** Called with the new HTML whenever the content changes. */
  onChange: (html: string) => void
  /** Placeholder shown while empty. */
  placeholder?: string
  /** Focus the editor on mount. */
  autoFocus?: boolean
  /** Min height of the writing area. Defaults to a ~4-row textarea. */
  minHeight?: string | number
  /** Extra classes for the outer container. */
  className?: string
  /** Disable editing. */
  disabled?: boolean
}

function ToolbarButton({
  active,
  title,
  onToggle,
  children,
}: {
  active: boolean
  title: string
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // onMouseDown (not onClick) + preventDefault keeps the editor selection so
      // the toggle applies to the current selection instead of losing focus.
      onMouseDown={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-nonsprimary/15 text-nonsprimary'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--border-subtle)] px-1.5 py-1">
      <ToolbarButton title="Bold" active={editor.isActive('bold')} onToggle={() => editor.chain().focus().toggleBold().run()}>
        <BsTypeBold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive('italic')} onToggle={() => editor.chain().focus().toggleItalic().run()}>
        <BsTypeItalic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Spoiler" active={editor.isActive('spoiler')} onToggle={() => editor.chain().focus().toggleSpoiler().run()}>
        <BsEyeSlash className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onToggle={() => editor.chain().focus().toggleBlockquote().run()}>
        <BsBlockquoteLeft className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}

// A minimal TipTap editor for writing reviews: bold, italic and spoilers only.
// Produces HTML, which ReviewContent renders back. Shared by every place a
// review is written (the finish modal, the media page's "my review").
export default function ReviewEditor({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  minHeight = '5.5rem',
  className = '',
  disabled = false,
}: ReviewEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: reviewExtensions(placeholder),
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'review-editor outline-none',
        style: `min-height: ${typeof minHeight === 'number' ? `${minHeight}px` : minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      // Normalise "empty" to '' so callers can compare against a cleared review.
      const html = editor.getHTML()
      onChange(editor.isEmpty ? '' : html)
    },
  })

  // Keep the editor in sync when the value is reset externally (e.g. the modal
  // reopens for another item, or an edit is cancelled).
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (autoFocus && editor) editor.commands.focus('end')
  }, [autoFocus, editor])

  if (!editor) return null

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--input)] transition-colors focus-within:border-nonsprimary/40 ${className}`}
      onClick={() => editor.commands.focus()}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="cursor-text px-3 py-2" />
    </div>
  )
}
