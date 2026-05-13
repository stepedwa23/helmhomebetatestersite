import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useEffect } from 'react'
import type { TipTapDoc } from '../../types'

interface TipTapViewProps {
  /** TipTap JSON document. Null/undefined renders an empty placeholder. */
  content: TipTapDoc
  /** Optional className on the outer wrapper. */
  className?: string
  /** Override the empty-state message. */
  emptyText?: string
}

/**
 * Read-only renderer for TipTap content. Uses the same TipTap extensions as
 * TipTapEditor so what the admin authors is exactly what testers see.
 *
 * Wrapped in Tailwind's `prose` typography styles for that "Word document"
 * reading feel — clean heading hierarchy, comfortable line height, sensible
 * measure. The typography plugin is registered in src/index.css via
 * `@plugin "@tailwindcss/typography";` (Tailwind v4 syntax).
 */
export default function TipTapView({
  content,
  className = '',
  emptyText = 'Nothing to show yet.',
}: TipTapViewProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'rounded-lg my-2 max-w-full h-auto' },
      }),
    ],
    editable: false,
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: `prose prose-slate max-w-none ${className}`,
      },
    },
  })

  // Keep view in sync if the content prop changes (e.g. parent fetched newer data).
  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    const next = content ?? { type: 'doc', content: [] }
    if (JSON.stringify(current) === JSON.stringify(next)) return
    editor.commands.setContent(next, false)
  }, [content, editor])

  if (!editor) {
    return <div className={`text-sm text-gray-400 ${className}`}>Loading…</div>
  }

  // Treat an empty doc (no content, or just a single empty paragraph) as "empty".
  const isEmpty =
    !content ||
    !(content as { content?: unknown[] }).content?.length ||
    editor.isEmpty

  if (isEmpty) {
    return <p className={`text-sm text-gray-500 italic ${className}`}>{emptyText}</p>
  }

  return <EditorContent editor={editor} />
}
