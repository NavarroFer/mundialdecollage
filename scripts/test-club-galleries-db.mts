// Applies the Club migration and exercises its money/ownership invariants in
// one transaction that is always rolled back.
// node --env-file=.env.local scripts/test-club-galleries-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'supabase/migrations/20261029120000_club_galleries.sql',
  'utf8',
)

const query = `begin;
${migration}

create temporary table club_probe(actor uuid, subscription uuid, gallery uuid);

do $$
declare
  actor_id uuid;
  customer_id uuid;
  subscription_id uuid;
  gallery_id uuid;
  applied integer := 0;
begin
  select u.id into actor_id
  from auth.users u
  where exists (select 1 from public.profiles p where p.id = u.id)
  order by u.created_at
  limit 1;
  if actor_id is null then raise exception 'Club probe needs one registered user'; end if;

  insert into public.customers(email, full_name)
  values ('club-db-probe@example.invalid', 'Club DB Probe')
  returning id into customer_id;

  insert into public.subscriptions(
    customer_id, provider, provider_subscription_id, provider_plan_id,
    status, shipping_address
  ) values (
    customer_id, 'mercadopago', 'club-db-probe-subscription', 'mp:club',
    'pending', null
  ) returning id into subscription_id;

  insert into public.club_galleries(
    user_id, subscription_id, slug, title, host_avatar_id
  ) values (
    actor_id, subscription_id, 'club-db-probe', 'Club DB Probe', 'adult-female-01'
  ) returning id into gallery_id;

  if not public.credit_club_coins(actor_id, 6000, 'purchase', 'club-db-probe-credit') then
    raise exception 'Initial credit was not applied';
  end if;
  if public.credit_club_coins(actor_id, 6000, 'purchase', 'club-db-probe-credit') then
    raise exception 'Repeated credit was applied twice';
  end if;

  for applied in 1..7 loop
    perform public.credit_club_activity_coins(actor_id, 3, 'club-db-probe-activity-' || applied);
  end loop;
  if (select coalesce(sum(delta), 0) from public.coin_transactions
      where user_id = actor_id and kind = 'activity') <> 20 then
    raise exception 'Daily activity cap is not 20';
  end if;

  insert into club_probe values (actor_id, subscription_id, gallery_id);
end $$;

select set_config('request.jwt.claim.sub', (select actor::text from club_probe), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.spend_coins_on_item('room:classic');
select public.spend_coins_on_item('room:classic');
reset role;

do $$
declare
  actor_id uuid := (select actor from club_probe);
  subscription_id uuid := (select subscription from club_probe);
  gallery_id uuid := (select gallery from club_probe);
begin
  if not exists (select 1 from public.user_gallery_inventory
      where user_id = actor_id and item_id = 'room:classic') then
    raise exception 'Purchased room missing from inventory';
  end if;
  if (select count(*) from public.coin_transactions
      where user_id = actor_id and kind = 'spend' and reference_id = actor_id::text || ':room:classic') <> 1 then
    raise exception 'Repeated spend was not idempotent';
  end if;

  update public.club_galleries set template_id = 'classic' where id = gallery_id;
  if not public.record_subscription_payment(
    'mercadopago', 'club-db-probe-payment', 'club-db-probe-subscription', 29000, null, 'ARS'
  ) then raise exception 'First Club payment was not recorded'; end if;
  if public.record_subscription_payment(
    'mercadopago', 'club-db-probe-payment', 'club-db-probe-subscription', 29000, null, 'ARS'
  ) then raise exception 'Repeated Club payment was recorded twice'; end if;

  if (select count(*) from public.coin_transactions
      where user_id = actor_id and kind = 'subscription_bonus') <> 1 then
    raise exception 'Monthly bonus was not idempotent';
  end if;
  if (select delta from public.coin_transactions
      where user_id = actor_id and kind = 'subscription_bonus') <> 600 then
    raise exception 'Monthly bonus is not the 600 coins of lib/store.ts';
  end if;
  if exists (
    select 1 from public.shipments s
    join public.payments p on p.id = s.payment_id
    where p.provider_payment_id = 'club-db-probe-payment'
  ) then raise exception 'Digital Club payment created a shipment'; end if;
  if (select status from public.club_galleries where id = gallery_id) <> 'active' then
    raise exception 'Paid Club gallery was not activated';
  end if;

  update public.subscriptions set status = 'suspended' where id = subscription_id;
  if (select status from public.club_galleries where id = gallery_id) <> 'paused' then
    raise exception 'Suspended Club subscription did not pause its gallery';
  end if;

  if has_table_privilege('authenticated', 'public.club_wallets', 'INSERT')
     or has_table_privilege('authenticated', 'public.coin_transactions', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_gallery_inventory', 'INSERT') then
    raise exception 'Authenticated clients can mutate Club money tables directly';
  end if;
  if has_function_privilege('anon', 'public.spend_coins_on_item(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.credit_club_coins(uuid,integer,text,text)', 'EXECUTE') then
    raise exception 'Privileged Club RPC exposed to the wrong role';
  end if;
end $$;

select jsonb_build_object(
  'passed', true,
  'checks', 'credit idempotency, daily cap, spend idempotency, unlock validation, digital payment, monthly bonus, pause, grants'
) as test_result;
rollback;`

const response = await fetch(
  `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(120_000),
  },
)
const body = await response.text()
if (!response.ok) throw new Error(body)
console.log(body)
