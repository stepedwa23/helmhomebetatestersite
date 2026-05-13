// =============================================================================
// notify-feedback-submitted
//
// Body: { feedback_id: string }
// Sends: ack to tester + admin alert.
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { sendEmail, adminNotificationEmail } from '../_shared/resend.ts'

interface Body { feedback_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { feedback_id } = (await req.json()) as Body
    if (!feedback_id) return json({ error: 'feedback_id required' }, 400)

    const service = createServiceClient()

    const { data: rows, error } = await service
      .from('feedback')
      .select(`
        id, rating, comments, submitted_at,
        tester:testers ( name, email ),
        project:projects ( name ),
        cycle:test_cycles ( name )
      `)
      .eq('id', feedback_id)
      .limit(1)
    if (error) throw error
    const f = rows?.[0]
    if (!f) return json({ error: 'feedback not found' }, 404)

    if (f.tester?.email) {
      await sendEmail({
        to: f.tester.email,
        subject: 'Thanks for the feedback',
        html: `
          <p>Hi ${escapeHtml(f.tester.name)},</p>
          <p>Got your feedback on ${escapeHtml(f.cycle?.name ?? f.project?.name ?? 'the beta')}. Appreciate it.</p>
        `,
      })
    }

    await sendEmail({
      to: adminNotificationEmail(),
      subject: `[${f.project?.name ?? 'Beta'}] New feedback (${f.rating}/5)`,
      html: `
        <p>Rating: <strong>${f.rating}/5</strong></p>
        <p>From: ${escapeHtml(f.tester?.name ?? '?')} &lt;${escapeHtml(f.tester?.email ?? '?')}&gt;</p>
        <p>Cycle: ${escapeHtml(f.cycle?.name ?? '(none)')}</p>
        <hr>
        <p>${escapeHtml(f.comments ?? '').replace(/\n/g, '<br>')}</p>
      `,
    })

    return json({ sent: true }, 200)
  } catch (err) {
    console.error('notify-feedback-submitted error', err)
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
