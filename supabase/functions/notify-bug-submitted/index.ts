// =============================================================================
// notify-bug-submitted
//
// Caller: client, fire-and-forget after submitBug() succeeds.
// Sends:
//   1) Acknowledgement email to the tester who filed the bug.
//   2) Admin alert email to ADMIN_NOTIFICATION_EMAIL.
//
// Body: { bug_id: string }
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { sendEmail, adminNotificationEmail } from '../_shared/resend.ts'

interface Body { bug_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { bug_id } = (await req.json()) as Body
    if (!bug_id) return json({ error: 'bug_id required' }, 400)

    const service = createServiceClient()

    // Pull the bug + tester + project context in one shot.
    const { data: bugRows, error } = await service
      .from('bug_reports')
      .select(`
        id, title, description, severity, category, helm_version, os, submitted_at,
        tester:testers ( id, name, email ),
        project:projects ( id, name )
      `)
      .eq('id', bug_id)
      .limit(1)
    if (error) throw error
    const bug = bugRows?.[0]
    if (!bug) return json({ error: 'bug not found' }, 404)

    // 1) Ack to tester.
    if (bug.tester?.email) {
      await sendEmail({
        to: bug.tester.email,
        subject: `Got your bug report: ${bug.title}`,
        html: `
          <p>Hi ${escapeHtml(bug.tester.name)},</p>
          <p>Thanks for filing <strong>${escapeHtml(bug.title)}</strong> on ${escapeHtml(bug.project?.name ?? '')}.
          It's logged with severity <strong>${escapeHtml(bug.severity)}</strong> and we'll take a look.</p>
          <p>You can check status anytime from your dashboard.</p>
        `,
      })
    }

    // 2) Admin alert.
    await sendEmail({
      to: adminNotificationEmail(),
      subject: `[${bug.project?.name ?? 'Beta'}] New bug: ${bug.title} (${bug.severity})`,
      html: `
        <p><strong>${escapeHtml(bug.title)}</strong></p>
        <p>Severity: ${escapeHtml(bug.severity)} · Category: ${escapeHtml(bug.category)} · Helm: ${escapeHtml(bug.helm_version ?? '?')} · OS: ${escapeHtml(bug.os ?? '?')}</p>
        <p>From: ${escapeHtml(bug.tester?.name ?? '?')} &lt;${escapeHtml(bug.tester?.email ?? '?')}&gt;</p>
        <hr>
        <p>${escapeHtml(bug.description).replace(/\n/g, '<br>')}</p>
      `,
    })

    return json({ sent: true }, 200)
  } catch (err) {
    console.error('notify-bug-submitted error', err)
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
