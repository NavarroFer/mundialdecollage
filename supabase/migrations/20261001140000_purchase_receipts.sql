-- Thank-you / confirmation mail after a purchase (lib/receipts.ts). Set when
-- the mail is claimed for sending, so the webhook and the return page —
-- which can both see the same payment — never send it twice.
alter table public.magazine_orders add column if not exists receipt_sent_at timestamptz;
alter table public.entry_purchases add column if not exists receipt_sent_at timestamptz;
alter table public.subscriptions add column if not exists receipt_sent_at timestamptz;

notify pgrst, 'reload schema';
