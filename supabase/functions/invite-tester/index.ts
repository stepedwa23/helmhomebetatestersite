// =============================================================================
// invite-tester
//
// Caller: admin (project owner), via supabase.functions.invoke().
// Sends a Supabase Auth magic-link invitation to an EXISTING tester row.
// Updates `invited_at` to now() so the admin UI shows when the last invite
// was sent.
//
// The tester row is created beforehand via a direct INSERT from the admin
// client (RLS allows admins to insert into `testers` for their project).
// This function only handles the side effect that requires the service-role
// key: calling `auth.admin.inviteUserByEmail`.
//
// Expected body:
//   { tester_id: string }
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

interface InviteTesterBody {
  tester_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as InviteTesterBody
    if (!body.tester_id) {
      return json({ error: 'tester_id is required' }, 400)
    }

    // 1. Identify the caller from their session JWT.
    const userClient = createUserClient(req.headers.get('authorization'))
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    // 2. Load the tester + verify the caller is the project owner.
    //    Use service role here so we get a clean read regardless of RLS state,
    //    then check ownership ourselves.
    const service = createServiceClient()
    const { data: testerRows, error: lookupErr } = await service
      .from('testers')
      .select('id, email, project_id')
      .eq('id', body.tester_id)
      .limit(1)
    if (lookupErr) throw lookupErr
    const tester = testerRows?.[0]
    if (!tester) return json({ error: 'Tester not found' }, 404)

    const { data: projectRows, error: projErr } = await service
      .from('projects')
      .select('id, owner_id')
      .eq('id', tester.project_id)
      .limit(1)
    if (projErr) throw projErr
    if (projectRows?.[0]?.owner_id !== user.id) {
      return json({ error: 'Only the project owner can invite testers' }, 403)
    }

    // 3. Send the magic-link invite via Supabase Auth admin API.
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL')
    const redirectTo = siteUrl ? `${siteUrl}/welcome` : undefined

    const { error: inviteErr } = await service.auth.admin.inviteUserByEmail(
      tester.email,
      redirectTo ? { redirectTo } : undefined,
    )
    if (inviteErr) {
      // If the email was already used to create an auth user, the invite call
      // will fail. Surface that as a 409 so the admin knows.
      const msg = inviteErr.message || 'invite failed'
      const status = /already (registered|exists)/i.test(msg) ? 409 : 500
      return json({ error: msg }, status)
    }

    // 4. Stamp invited_at so the UI can show "invited 2 minutes ago".
    const { error: stampErr } = await service
      .from('testers')
      .update({ invited_at: new Date().toISOString(), status: 'invited' })
      .eq('id', tester.id)
    if (stampErr) console.warn('Failed to update invited_at', stampErr)

    return json({ sent: true, tester_id: tester.id }, 200)
  } catch (err) {
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
