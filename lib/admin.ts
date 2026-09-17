// Only these accounts get into /admin — everyone else who logs in with
// Google is treated as a normal site visitor. Keep this in sync with
// is_admin() in supabase/migrations/20260917000000_admin_mailing.sql —
// that's the real security boundary (RLS), this is just the page-level gate.
export const ADMIN_EMAILS = ['mundialdecollage@gmail.com', 'fernando.navarro.mdp@gmail.com']
