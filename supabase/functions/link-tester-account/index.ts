// =============================================================================
// link-tester-account
//
// Caller: invoked from the client immediately after a new tester completes
// signup (sets their password via the /welcome flow). It matches the new
// auth user to the pending tester row by email, sets user_id, status='active',
// and joined_at=now().
//
// Why a function (vs. a DB trigger):
//   Supabase doesn't expose a stable webhook on auth.users.created for free,
//   and writing triggers on the auth schema is messy. A small client-invoked
//   function with the service role is simpler and fully observable.
//
// This function trusts the caller is who they say they are because we read
// the user from the auth header (their session JWT) rather than the body.
// =============================================================================

import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const userClient = createUserClient(req.headers.get('authorization'))
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user?.email) return json({ error: 'Not authenticated' }, 401)

    const service = createServiceClient()

    // Find a pending tester row matching this email.
    const { data: rows, error } = await service
      .from('testers')
      .select('*')
      .eq('email', user.email)
      .is('user_id', null)
      .limit(1)
    if (error) throw error
    if (!rows?.[0]) return json({ linked: false, reason: 'no pending invite' }, 200)

    const { error: updateErr } = await service
      .from('testers')
      .update({
        user_id: user.id,
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id)
    if (updateErr) throw updateErr

    return json({ linked: true, tester_id: rows[0].id }, 200)
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
