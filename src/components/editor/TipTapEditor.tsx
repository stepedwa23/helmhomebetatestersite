import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from 'lucide-react'
import type { TipTapDoc } from '../../types'

interface TipTapEditorProps {
  /** Initial document (TipTap JSON). Pass null/undefined for empty. */
  initial?: TipTapDoc
  /** Fires on every change with the current TipTap JSON document. */
  onChange: (doc: TipTapDoc) => void
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string
  /** Optional className on the outer container. */
  className?: string
}

/**
 * Rich-text editor backed by TipTap. Outputs TipTap's native JSON so we avoid
 * HTML serialization (and the associated XSS sanitization burden).
 *
 * Stored content goes into `app_versions.patch_notes` and `help_articles.body`
 * — both jsonb columns. The matching read-only renderer is TipTapView.
 */
export default function TipTapEditor({
  initial,
  onChange,
  placeholder,
  className = '',
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We keep the defaults: bold, italic, strike, code, heading (1-6),
        // bulletList, orderedList, blockquote, codeBlock, horizontalRule,
        // hardBreak, history (undo/redo), paragraph.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'rounded-lg my-2 max-w-full h-auto' },
      }),
      // Markdown paste support. Many sources (Cowork chat, Claude.ai, ChatGPT,
      // Notion outline copies, etc.) put the markdown SOURCE on the clipboard
      // rather than rendered HTML. Without this extension, `# Heading` and
      // `**bold**` come in as literal text. With `transformPastedText: true`
      // they're converted to TipTap nodes on paste.
      //
      // We do NOT enable transformCopiedText — that would change copy behavior
      // so users get markdown when copying out of the editor, which can confuse
      // anyone pasting into another rich editor. Authoring stores TipTap JSON
      // as before; nothing about the data model changes.
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
        breaks: false,
        linkify: true,
        tightLists: true,
      }),
    ],
    content: initial ?? undefined,
    onUpdate({ editor }) {
      onChange(editor.getJSON() as TipTapDoc)
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  })

  // Sync external content changes back to the editor (e.g. parent resets the form).
  // We only update when the incoming JSON differs from the current editor content
  // to avoid clobbering local edits or causing cursor jumps.
  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    if (JSON.stringify(current) === JSON.stringify(initial ?? { type: 'doc', content: [] })) {
      return
    }
    editor.commands.setContent(initial ?? { type: 'doc', content: [] }, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, editor])

  if (!editor) {
    return (
      <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
        <div className="px-4 py-3 text-sm text-gray-400">Loading editor…</div>
      </div>
    )
  }

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${className}`}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  )
}

// ---------- Toolbar ----------

interface ToolbarProps {
  editor: Editor
}

function Toolbar({ editor }: ToolbarProps) {
  function promptLink() {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function promptImage() {
    const url = window.prompt('Image URL (must already be publicly hosted)', 'https://')
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="Bold"
        icon={Bold}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="Italic"
        icon={Italic}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        label="Strikethrough"
        icon={Strikethrough}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        label="Inline code"
        icon={CodeIcon}
      />
      <Divider />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        label="Heading 1"
        icon={Heading1}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        label="Heading 2"
        icon={Heading2}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        label="Heading 3"
        icon={Heading3}
      />
      <Divider />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="Bulleted list"
        icon={List}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        label="Numbered list"
        icon={ListOrdered}
      />
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        label="Blockquote"
        icon={Quote}
      />
      <Divider />
      <Btn onClick={promptLink} active={editor.isActive('link')} label="Link" icon={LinkIcon} />
      <Btn onClick={promptImage} active={false} label="Image" icon={ImageIcon} />
      <Divider />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        active={false}
        label="Undo"
        icon={Undo}
        disabled={!editor.can().undo()}
      />
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        active={false}
        label="Redo"
        icon={Redo}
        disabled={!editor.can().redo()}
      />
    </div>
  )
}

function Btn({
  onClick,
  active,
  label,
  icon: Icon,
  disabled = false,
}: {
  onClick: () => void
  active: boolean
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-700 hover:bg-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-300" aria-hidden />
}
