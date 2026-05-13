// =============================================================================
// notify-version-published
//
// Caller: admin (project owner). Invoked from the React admin UI when Stephen
// publishes a new version or explicitly clicks "Notify testers".
//
// Body:
//   {
//     version_id: string,
//     rendered_html: string   // TipTap notes already rendered client-side
//   }
//
// Flow:
//   1. Verify caller is the project owner (via their session JWT).
//   2. Load the version and the list of ACTIVE testers in that project.
//   3. Build a per-tester email using the supplied rendered_html + version meta.
//   4. Send each via Resend. Collect successes + failures.
//   5. Return { sent, failed, total }.
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import { sendEmail } from '../_shared/resend.ts'

interface Body {
  version_id: string
  rendered_html: string
}

interface FailureEntry {
  email: string
  error: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as Body
    if (!body.version_id) return json({ error: 'version_id required' }, 400)

    // 1. Identify caller.
    const userClient = createUserClient(req.headers.get('authorization'))
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    // 2. Load version + verify caller is project owner.
    const service = createServiceClient()
    const { data: versionRows, error: vErr } = await service
      .from('app_versions')
      .select('id, version, release_date, project_id')
      .eq('id', body.version_id)
      .limit(1)
    if (vErr) throw vErr
    const version = versionRows?.[0]
    if (!version) return json({ error: 'Version not found' }, 404)

    const { data: projectRows, error: pErr } = await service
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', version.project_id)
      .limit(1)
    if (pErr) throw pErr
    const project = projectRows?.[0]
    if (!project || project.owner_id !== user.id) {
      return json({ error: 'Only the project owner can send notifications' }, 403)
    }

    // 3. Load active testers in this project.
    const { data: testers, error: tErr } = await service
      .from('testers')
      .select('id, name, email')
      .eq('project_id', version.project_id)
      .eq('status', 'active')
    if (tErr) throw tErr

    if (!testers || testers.length === 0) {
      return json({ sent: 0, failed: [], total: 0, message: 'No active testers to notify.' }, 200)
    }

    // 4. Send.
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? ''
    const subject = `${project.name} ${version.version} is out`
    const releaseDate = version.release_date
      ? new Date(version.release_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : ''

    const failures: FailureEntry[] = []
    let sent = 0

    for (const tester of testers) {
      if (!tester.email) continue
      const html = renderEmail({
        testerName: tester.name,
        projectName: project.name,
        version: version.version,
        releaseDate,
        siteUrl,
        notesHtml: body.rendered_html ?? '',
      })
      try {
        await sendEmail({
          to: tester.email,
          subject,
          html,
        })
        sent++
      } catch (err) {
        failures.push({
          email: tester.email,
          error: err instanceof Error ? err.message : 'send failed',
        })
      }
    }

    return json({ sent, failed: failures, total: testers.length }, 200)
  } catch (err) {
    console.error('[notify-version-published] error', err)
    return json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      500,
    )
  }
})

// ---------- Email template ----------

interface EmailContext {
  testerName: string
  projectName: string
  version: string
  releaseDate: string
  siteUrl: string
  notesHtml: string
}

function renderEmail(ctx: EmailContext): string {
  // Inline styles only — most email clients (especially Outlook) strip <style>
  // blocks. Tables for layout, since flex/grid are unsupported in many clients.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(ctx.projectName)} ${escapeHtml(ctx.version)} is out</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 28px;background:#1d4ed8;color:#ffffff;">
              <div style="font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#dbeafe;">
                ${escapeHtml(ctx.projectName)} beta
              </div>
              <div style="font-size:22px;font-weight:700;margin-top:4px;">
                ${escapeHtml(ctx.version)} is out
              </div>
              ${ctx.releaseDate ? `<div style="font-size:13px;color:#dbeafe;margin-top:4px;">Released ${escapeHtml(ctx.releaseDate)}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#111827;">
                Hi ${escapeHtml(ctx.testerName)},
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#111827;">
                A new build is ready. Here's what changed:
              </p>
              <div style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#1f2937;">
                ${ctx.notesHtml}
              </div>
              ${
                ctx.siteUrl
                  ? `<p style="margin:24px 0 0;">
                      <a href="${escapeAttr(ctx.siteUrl)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open the tester site</a>
                    </p>
                    <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
                      Sign in to download the latest installer for your platform.
                    </p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#6b7280;">
              You're receiving this because you're a beta tester for ${escapeHtml(ctx.projectName)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ---------- helpers ----------

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

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
