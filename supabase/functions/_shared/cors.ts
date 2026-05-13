// Shared CORS headers for Edge Functions invoked from the browser via
// supabase.functions.invoke(). Adjust the allowed origin once you have a
// stable Netlify URL.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
