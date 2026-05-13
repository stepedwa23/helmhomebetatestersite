import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Service-role client — bypasses RLS. Use ONLY in Edge Functions. */
export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in function env')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Client scoped to the caller's auth (forwards the user's JWT). Use this to
 * verify the caller is an admin or a tester before doing privileged work.
 */
export function createUserClient(authHeader: string | null): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing in function env')
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  })
}
