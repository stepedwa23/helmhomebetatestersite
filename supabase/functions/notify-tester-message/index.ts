// =============================================================================
// notify-tester-message
//
// Caller: client, fire-and-forget after inserting a row into tester_messages.
// Sends:
//   1) Admin email to ADMIN_NOTIFICATION_EMAIL with Reply-To set to the
//      tester's email, so admin can hit Reply and respond directly.
//
// Body: { message_id: string }
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { sendEmail, adminNotificationEmail } from '../_shared/resend.ts'

interface Body { message_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { message_id } = (await req.json()) as Body
    if (!message_id) return json({ error: 'message_id required' }, 400)

    const service = createServiceClient()

    const { data: rows, error } = await service
      .from('tester_messages')
      .select(`
        id, subject, body, created_at,
        tester:testers ( id, name, email ),
        project:projects ( id, name )
      `)
      .eq('id', message_id)
      .limit(1)
    if (error) throw error
    const msg = rows?.[0]
    if (!msg) return json({ error: 'message not found' }, 404)

    const testerName = msg.tester?.name ?? 'A tester'
    const testerEmail = msg.tester?.email ?? null
    const projectName = msg.project?.name ?? 'Beta'

    await sendEmail({
      to: adminNotificationEmail(),
      replyTo: testerEmail ?? undefined,
      subject: `[${projectName}] Message from ${testerName}: ${msg.subject}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(testerName)}${testerEmail ? ` &lt;${escapeHtml(testerEmail)}&gt;` : ''}</p>
        <p><strong>Subject:</strong> ${escapeHtml(msg.subject)}</p>
        <hr>
        <p>${escapeHtml(msg.body).replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color:#888;font-size:12px">Hit Reply to respond directly to ${escapeHtml(testerName)}. The message is also logged in your admin Messages inbox.</p>
      `,
    })

    return json({ sent: true }, 200)
  } catch (err) {
    console.error('notify-tester-message error', err)
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
