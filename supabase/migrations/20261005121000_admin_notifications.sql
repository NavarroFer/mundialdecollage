-- Admin notices for the bell (20261005120000_notifications.sql), in Spanish
-- like the rest of the panel (lib/notifications/registry.ts):
--   - grouped counts that follow what's waiting: comments and collective
--     collage photos to moderate, Registro obras whose image couldn't be
--     fetched;
--   - a campaign that finished with failed sends;
--   - money in: magazine orders, extra entries, store payments.

-- What each grouped admin notice counts. Adding one: a branch here plus a
-- statement trigger on the table it counts.
create or replace function public.admin_notice_count(kind text)
returns integer
language sql stable security definer set search_path = '' as $$
  select (case kind
    when 'admin_comments_pending' then (select count(*) from public.artwork_comments where status = 'pending')
    when 'admin_wall_pending' then (select count(*) from public.wall_pieces where status = 'pending')
    -- Same rows /admin/obras lists at the top as "sin imagen".
    when 'admin_images_failed' then (
      select count(*) from public.legacy_submissions
      where archived_at is null and image_fetch_failed_at is not null and image_url is null
    )
  end)::integer
$$;

-- Brings a grouped admin notice in line with its count: gone at zero; back
-- to unread only when there's more waiting than before (moderating lowers
-- the count and shouldn't light the bell again).
create or replace function public.sync_admin_count_notice(kind text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  total integer := coalesce(public.admin_notice_count(kind), 0);
begin
  if total <= 0 then
    delete from public.notifications where admin and dedupe_key = kind;
    return;
  end if;

  insert into public.notifications as n (user_id, type, admin, dedupe_key, data)
  select admin_id, kind, true, kind, jsonb_build_object('count', total)
  from public.admin_user_ids() as admin_id
  on conflict (user_id, dedupe_key) do update
    set data = excluded.data,
        read_at = case when (n.data ->> 'count')::integer < total then null else n.read_at end,
        updated_at = case when (n.data ->> 'count')::integer < total then now() else n.updated_at end
    where n.data ->> 'count' is distinct from excluded.data ->> 'count';
end;
$$;

-- Grouped admin notices: recounted after any statement that can change them.
create or replace function public.on_admin_count_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_admin_count_notice(tg_argv[0]);
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists artwork_comments_admin_notice on public.artwork_comments;
create trigger artwork_comments_admin_notice
  after insert or update of status or delete on public.artwork_comments
  for each statement execute function public.on_admin_count_change('admin_comments_pending');

drop trigger if exists wall_pieces_admin_notice on public.wall_pieces;
create trigger wall_pieces_admin_notice
  after insert or update of status or delete on public.wall_pieces
  for each statement execute function public.on_admin_count_change('admin_wall_pending');

drop trigger if exists legacy_submissions_admin_notice on public.legacy_submissions;
create trigger legacy_submissions_admin_notice
  after insert or update of image_fetch_failed_at, image_url, archived_at or delete on public.legacy_submissions
  for each statement execute function public.on_admin_count_change('admin_images_failed');

-- A campaign that finished with failed sends (lib/campaign-delivery.ts, or a
-- retry from /admin/campanas). Gone once a retry gets every mail out.
create or replace function public.on_campaign_result()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status not in ('sent', 'failed') then
    return null;
  end if;
  if new.failed_count > 0 then
    perform public.notify_admins(
      'admin_campaign_failed',
      jsonb_build_object(
        'campaignId', new.id, 'subject', new.subject, 'status', new.status,
        'failed', new.failed_count, 'total', new.recipient_count
      ),
      'campaign:' || new.id,
      old.status = 'sending' or new.failed_count > old.failed_count
    );
  else
    delete from public.notifications where admin and dedupe_key = 'campaign:' || new.id;
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists campaigns_notify on public.campaigns;
create trigger campaigns_notify
  after update of status, failed_count on public.campaigns
  for each row
  when (old.status is distinct from new.status or old.failed_count is distinct from new.failed_count)
  execute function public.on_campaign_result();

-- Money in: a paid magazine order, a paid extra-entries purchase, a store
-- payment (PayPal or Mercado Pago, one-off or a subscription's monthly charge).
create or replace function public.on_magazine_paid()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.notify_admins(
      'admin_magazine_paid',
      jsonb_build_object('orderId', new.id, 'name', new.name, 'quantity', new.quantity, 'amount', new.amount, 'currency', new.currency),
      'magazine:' || new.id
    );
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists magazine_orders_notify on public.magazine_orders;
create trigger magazine_orders_notify
  after insert or update of status on public.magazine_orders
  for each row execute function public.on_magazine_paid();

create or replace function public.on_entry_purchase_paid()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.notify_admins(
      'admin_entry_paid',
      jsonb_build_object(
        'purchaseId', new.id, 'email', new.email, 'entries', new.entries_allowed,
        'amount', new.amount, 'currency', new.currency, 'provider', new.provider
      ),
      'entry:' || new.id
    );
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists entry_purchases_notify on public.entry_purchases;
create trigger entry_purchases_notify
  after insert or update of status on public.entry_purchases
  for each row execute function public.on_entry_purchase_paid();

create or replace function public.on_store_payment()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' then
    perform public.notify_admins(
      'admin_store_paid',
      jsonb_build_object('paymentId', new.id, 'kind', new.kind, 'amount', new.amount, 'currency', new.currency, 'provider', new.provider),
      'store:' || new.id
    );
  end if;
  return null;
exception when others then
  -- A notice must never undo what it reports (a payment, a like…).
  raise warning 'notifications: % failed: %', tg_name, sqlerrm;
  return null;
end;
$$;

drop trigger if exists payments_notify on public.payments;
create trigger payments_notify
  after insert on public.payments
  for each row execute function public.on_store_payment();

revoke all on function public.admin_notice_count(text) from public, anon, authenticated;
revoke all on function public.sync_admin_count_notice(text) from public, anon, authenticated;
revoke all on function public.on_admin_count_change() from public, anon, authenticated;
revoke all on function public.on_campaign_result() from public, anon, authenticated;
revoke all on function public.on_magazine_paid() from public, anon, authenticated;
revoke all on function public.on_entry_purchase_paid() from public, anon, authenticated;
revoke all on function public.on_store_payment() from public, anon, authenticated;

-- What's already waiting shows up right away, without waiting for the next change.
select public.sync_admin_count_notice('admin_comments_pending');
select public.sync_admin_count_notice('admin_wall_pending');
select public.sync_admin_count_notice('admin_images_failed');

notify pgrst, 'reload schema';
