-- When a donation's money is free to use: Mercado Pago holds a payment for a
-- while after approving it («dinero por acreditar») and says until when, so
-- /admin/estadisticas shows which donations are still on their way to the
-- account. Null for PayPal, which doesn't hold it, and for older rows.
alter table public.donations add column if not exists available_at timestamptz;

notify pgrst, 'reload schema';
