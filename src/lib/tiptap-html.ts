import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import type { TipTapDoc } from '../types'

/**
 * Render a TipTap JSON doc to HTML using the same extension set we use in
 * TipTapEditor + TipTapView. Keeps the email content visually consistent with
 * what testers see in-app.
 *
 * Used by the notify-testers flow — the client renders to HTML and passes the
 * string to the notify-version-published Edge Function so the function doesn't
 * need its own TipTap setup (and avoids Deno/jsdom hassles).
 */
export function renderTipTapToHtml(doc: TipTapDoc): string {
  if (!doc) {
    return '<p><em>No patch notes for this version.</em></p>'
  }
  try {
    return generateHTML(doc as Parameters<typeof generateHTML>[0], [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ])
  } catch (err) {
    console.error('[tiptap-html] Render failed', err)
    return '<p><em>(Could not render patch notes — see the site for the latest.)</em></p>'
  }
}
