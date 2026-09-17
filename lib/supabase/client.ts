import { createBrowserClient } from '@supabase/ssr'

// Only call this after checking isSupabaseConfigured — createBrowserClient
// throws if the URL/anon key are missing.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
