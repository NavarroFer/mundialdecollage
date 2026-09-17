import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Read-only, anon-key client for public pages (directory, mapa, /obras) that
// show submitted profiles to visitors with no session — no cookies needed,
// unlike lib/supabase/server.ts.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}
