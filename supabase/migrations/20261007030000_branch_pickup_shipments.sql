-- Existing address JSON stays readable; new checkouts save the official branch
-- identity and the authorized monthly total alongside the destination snapshot.
alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in ('pending', 'packed', 'shipped', 'awaiting_pickup', 'delivered', 'returned', 'cancelled'));
alter table public.shipments
  add column if not exists pickup_deadline date,
  add column if not exists shipped_notice_sent_at timestamptz,
  add column if not exists pickup_notice_sent_at timestamptz;
