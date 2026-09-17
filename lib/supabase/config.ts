// No Supabase project is wired up for this brand yet — everything auth-related
// checks this first and falls back to the pre-auth site (no sign-in button,
// no session checks) instead of throwing, so the build/site keep working until
// real NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
