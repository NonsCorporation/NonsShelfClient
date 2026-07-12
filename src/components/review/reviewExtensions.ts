import { Mark, mergeAttributes, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

// ============================================================================
// Spoiler mark (Telegram-style) — ported from nons-client's editor. Renders as
// `<span data-spoiler class="spoiler-text">`; the reader (ReviewContent) hides
// the text behind an animated dot pattern until the reader taps to reveal it.
// ============================================================================
export const Spoiler = Mark.create({
  name: 'spoiler',

  parseHTML() {
    return [{ tag: 'span[data-spoiler]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-spoiler': 'true',
        class: 'spoiler-text',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }: { commands: { toggleMark: (name: string) => boolean } }) =>
          commands.toggleMark(this.name),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.toggleSpoiler(),
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spoiler: {
      toggleSpoiler: () => ReturnType
    }
  }
}

// The full extension set for a review editor: the core document primitives plus
// bold, italic, spoilers and blockquotes — and nothing else. Everything else
// StarterKit would otherwise bring (headings, lists, code, strike, underline,
// links, horizontal rules) is turned off so a review stays simple.
export function reviewExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: false,
      horizontalRule: false,
    }),
    Placeholder.configure({ placeholder: placeholder ?? '' }),
    Spoiler,
  ]
}
