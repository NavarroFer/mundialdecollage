// Single-admin site: this is the only account allowed into /admin. Keep this
// in sync with is_admin() in supabase/migrations/20260917000000_admin_mailing.sql —
// that's the real security boundary (RLS), this is just the page-level gate.
export const ADMIN_EMAIL = 'fernavarro2607@gmail.com'
