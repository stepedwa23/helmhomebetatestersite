// =============================================================================
// notify-suggestion-submitted
//
// Body: { suggestion_id: string }
// Sends: ack to tester + admin alert.
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { sendEmail, adminNotificationEmail } from '../_shared/resend.ts'

interface Body { suggestion_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { suggestion_id } = (await req.json()) as Body
    if (!suggestion_id) return json({ error: 'suggestion_id required' }, 400)

    const service = createServiceClient()

    const { data: rows, error } = await service
      .from('suggestions')
      .select(`
        id, title, description, status, submitted_at,
        tester:testers ( name, email ),
        project:projects ( name )
      `)
      .eq('id', suggestion_id)
      .limit(1)
    if (error) throw error
    const s = rows?.[0]
    if (!s) return json({ error: 'suggestion not found' }, 404)

    if (s.tester?.email) {
      await sendEmail({
        to: s.tester.email,
        subject: `Got your suggestion: ${s.title}`,
        html: `
          <p>Hi ${escapeHtml(s.tester.name)},</p>
          <p>Thanks for suggesting <strong>${escapeHtml(s.title)}</strong>. We'll review it and update the status.</p>
        `,
      })
    }

    await sendEmail({
      to: adminNotificationEmail(),
      subject: `[${s.project?.name ?? 'Beta'}] New suggestion: ${s.title}`,
      html: `
        <p><strong>${escapeHtml(s.title)}</strong></p>
        <p>From: ${escapeHtml(s.tester?.name ?? '?')} &lt;${escapeHtml(s.tester?.email ?? '?')}&gt;</p>
        <hr>
        <p>${escapeHtml(s.description).replace(/\n/g, '<br>')}</p>
      `,
    })

    return json({ sent: true }, 200)
  } catch (err) {
    console.error('notify-suggestion-submitted error', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
