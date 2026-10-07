-- Existing subscriptions RLS keeps diagnostics accessible only to staff/service role.
alter table public.subscriptions add column if not exists checkout_error jsonb;
