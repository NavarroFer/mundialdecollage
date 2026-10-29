-- Club del Mundial, etapa 1: una galeria configurable por artista, con
-- billetera e inventario permanentes. Las visitas publicas solo leen
-- galerias activas; todos los movimientos de monedas se hacen dentro de la
-- base para que reintentos y pestanas simultaneas no dupliquen saldo.

alter table public.artworks
  add column if not exists is_club_only boolean not null default false;

create table public.club_galleries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  subscription_id uuid unique references public.subscriptions(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  statement text check (statement is null or length(statement) <= 5000),
  template_id text not null default 'cabinet'
    check (template_id in ('cabinet', 'classic', 'double')),
  theme text not null default 'collage'
    check (theme in ('collage', 'windows98', 'garden', 'atelier', 'industrial', 'museum', 'alley')),
  default_frame_style text not null default 'standard'
    check (default_frame_style in ('standard', 'wood', 'gold', 'black-mat', 'pinned')),
  host_avatar_id text not null check (length(btrim(host_avatar_id)) between 1 and 80),
  host_outfit jsonb not null default '{}'::jsonb check (jsonb_typeof(host_outfit) = 'object'),
  music_track text not null default 'default' check (length(music_track) between 1 and 120),
  contact_whatsapp text check (contact_whatsapp is null or length(contact_whatsapp) <= 40),
  contact_url text check (contact_url is null or length(contact_url) <= 500),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index club_galleries_status_idx on public.club_galleries(status);

create table public.club_gallery_hangings (
  gallery_id uuid not null references public.club_galleries(id) on delete cascade,
  slot integer not null check (slot between 1 and 22),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  frame_style text check (frame_style is null or frame_style in ('standard', 'wood', 'gold', 'black-mat', 'pinned')),
  for_sale boolean not null default false,
  price_label text check (price_label is null or length(price_label) <= 80),
  primary key (gallery_id, slot),
  unique (gallery_id, artwork_id)
);

create index club_gallery_hangings_artwork_idx on public.club_gallery_hangings(artwork_id);

create table public.club_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('subscription_bonus', 'purchase', 'activity', 'achievement', 'spend', 'refund')),
  reference_id text not null check (length(reference_id) between 1 and 240),
  created_at timestamptz not null default now(),
  unique (kind, reference_id)
);

create index coin_transactions_user_created_idx
  on public.coin_transactions(user_id, created_at desc);

create table public.user_gallery_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (length(item_id) between 1 and 120),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.club_galleries enable row level security;
alter table public.club_gallery_hangings enable row level security;
alter table public.club_wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.user_gallery_inventory enable row level security;

-- Project-wide default privileges give new tables broad authenticated CRUD
-- and anonymous SELECT. Narrow them before applying the Club-specific model.
revoke all on public.club_galleries, public.club_gallery_hangings,
  public.club_wallets, public.coin_transactions, public.user_gallery_inventory
  from anon, authenticated;

create policy "club galleries: public reads active" on public.club_galleries
  for select using (status = 'active');
create policy "club galleries: owner reads own" on public.club_galleries
  for select to authenticated using (user_id = auth.uid());
create policy "club galleries: owner creates own" on public.club_galleries
  for insert to authenticated with check (user_id = auth.uid() and status = 'draft');
create policy "club galleries: owner updates own" on public.club_galleries
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('draft', 'active', 'paused'));

create policy "club hangings: public reads active galleries" on public.club_gallery_hangings
  for select using (exists (
    select 1 from public.club_galleries g
    where g.id = gallery_id and g.status = 'active'
  ));
create policy "club hangings: owner reads own" on public.club_gallery_hangings
  for select to authenticated using (exists (
    select 1 from public.club_galleries g
    where g.id = gallery_id and g.user_id = auth.uid()
  ));
create policy "club hangings: owner inserts own" on public.club_gallery_hangings
  for insert to authenticated with check (exists (
    select 1 from public.club_galleries g
    join public.artworks a on a.id = artwork_id
    where g.id = gallery_id and g.user_id = auth.uid() and a.profile_id = auth.uid()
  ));
create policy "club hangings: owner updates own" on public.club_gallery_hangings
  for update to authenticated using (exists (
    select 1 from public.club_galleries g where g.id = gallery_id and g.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.club_galleries g
    join public.artworks a on a.id = artwork_id
    where g.id = gallery_id and g.user_id = auth.uid() and a.profile_id = auth.uid()
  ));
create policy "club hangings: owner deletes own" on public.club_gallery_hangings
  for delete to authenticated using (exists (
    select 1 from public.club_galleries g where g.id = gallery_id and g.user_id = auth.uid()
  ));

create policy "club wallets: owner reads own" on public.club_wallets
  for select to authenticated using (user_id = auth.uid());
create policy "coin transactions: owner reads own" on public.coin_transactions
  for select to authenticated using (user_id = auth.uid());
create policy "gallery inventory: owner reads own" on public.user_gallery_inventory
  for select to authenticated using (user_id = auth.uid());

grant select on public.club_galleries, public.club_gallery_hangings to anon;
grant select on public.club_galleries to authenticated;
grant insert (
  user_id, slug, title, statement, template_id, theme, default_frame_style,
  host_avatar_id, host_outfit, music_track, contact_whatsapp, contact_url
) on public.club_galleries to authenticated;
grant update (
  slug, title, statement, template_id, theme, default_frame_style,
  host_avatar_id, host_outfit, music_track, contact_whatsapp, contact_url
) on public.club_galleries to authenticated;
grant select, insert, update, delete on public.club_gallery_hangings to authenticated;
grant select on public.club_wallets, public.coin_transactions, public.user_gallery_inventory to authenticated;
grant select, insert, update, delete on public.club_galleries, public.club_gallery_hangings,
  public.club_wallets, public.coin_transactions, public.user_gallery_inventory to service_role;

-- Public artwork queries may see a work that is hanging in an active Club
-- gallery even when it is not the artist's selected competition entry.
create policy "artworks: public reads active club hangings" on public.artworks
  for select using (exists (
    select 1
    from public.club_gallery_hangings h
    join public.club_galleries g on g.id = h.gallery_id
    where h.artwork_id = artworks.id and g.status = 'active'
  ));

-- The SQL identifiers are the stable contract shared with
-- lib/gallery-catalog.ts. Outfit/accessory prices can be added here when the
-- product catalogue closes them; unknown identifiers are never purchasable.
create function public.club_catalog_price(p_item_id text)
returns integer
language sql immutable
set search_path = public
as $$
  select case p_item_id
    when 'frame:wood' then 300
    when 'frame:gold' then 300
    when 'frame:black-mat' then 300
    when 'frame:pinned' then 300
    when 'theme:atelier' then 1200
    when 'theme:industrial' then 1200
    when 'theme:museum' then 1200
    when 'theme:alley' then 1200
    when 'room:classic' then 2500
    when 'room:double' then 5000
    else null
  end
$$;

revoke all on function public.club_catalog_price(text) from public, anon, authenticated;
grant execute on function public.club_catalog_price(text) to service_role;

-- Validates that every non-base option saved by the owner belongs to their
-- permanent inventory. Optional outfit item ids live in
-- host_outfit.item_ids so arbitrary colour/material configuration remains
-- possible without weakening paid accessory checks.
create function public.validate_club_gallery_inventory()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare required_item text;
begin
  if new.template_id <> 'cabinet' and not exists (
    select 1 from public.user_gallery_inventory
    where user_id = new.user_id and item_id = 'room:' || new.template_id
  ) then raise exception 'Club item is not unlocked: %', 'room:' || new.template_id; end if;

  if new.theme not in ('collage', 'windows98', 'garden') and not exists (
    select 1 from public.user_gallery_inventory
    where user_id = new.user_id and item_id = 'theme:' || new.theme
  ) then raise exception 'Club item is not unlocked: %', 'theme:' || new.theme; end if;

  if new.default_frame_style <> 'standard' and not exists (
    select 1 from public.user_gallery_inventory
    where user_id = new.user_id and item_id = 'frame:' || new.default_frame_style
  ) then raise exception 'Club item is not unlocked: %', 'frame:' || new.default_frame_style; end if;

  if new.host_outfit ? 'item_ids' then
    if jsonb_typeof(new.host_outfit->'item_ids') <> 'array' then
      raise exception 'host_outfit.item_ids must be an array';
    end if;
    for required_item in select jsonb_array_elements_text(new.host_outfit->'item_ids') loop
      if not exists (
        select 1 from public.user_gallery_inventory
        where user_id = new.user_id and item_id = required_item
      ) then raise exception 'Club item is not unlocked: %', required_item; end if;
    end loop;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_club_gallery_inventory_before_write
before insert or update on public.club_galleries
for each row execute function public.validate_club_gallery_inventory();

revoke all on function public.validate_club_gallery_inventory() from public, anon, authenticated;

create function public.validate_club_gallery_hanging()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid;
declare room_template text;
declare room_capacity integer;
begin
  select user_id, template_id into owner_id, room_template
  from public.club_galleries where id = new.gallery_id;
  room_capacity := case room_template when 'cabinet' then 8 when 'classic' then 14 when 'double' then 22 end;
  if room_capacity is null or new.slot > room_capacity then
    raise exception 'Slot % is outside the selected Club room', new.slot;
  end if;
  if coalesce(new.frame_style, 'standard') <> 'standard' and not exists (
    select 1 from public.user_gallery_inventory
    where user_id = owner_id and item_id = 'frame:' || new.frame_style
  ) then
    raise exception 'Club item is not unlocked: %', 'frame:' || new.frame_style;
  end if;
  return new;
end;
$$;

create trigger validate_club_gallery_hanging_before_write
before insert or update on public.club_gallery_hangings
for each row execute function public.validate_club_gallery_hanging();

revoke all on function public.validate_club_gallery_hanging() from public, anon, authenticated;

-- Internal credit primitive. A provider payment or activity reference may
-- be retried any number of times but is applied once.
create function public.credit_club_coins(
  p_user_id uuid, p_delta integer, p_kind text, p_reference_id text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare affected integer := 0;
begin
  if p_delta <= 0 then raise exception 'Coin credit must be positive'; end if;
  if p_kind not in ('subscription_bonus', 'purchase', 'activity', 'achievement', 'refund') then
    raise exception 'Invalid coin credit kind';
  end if;
  if p_reference_id is null or length(p_reference_id) not between 1 and 240 then
    raise exception 'Invalid coin reference';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  insert into public.coin_transactions(user_id, delta, kind, reference_id)
    values (p_user_id, p_delta, p_kind, p_reference_id)
    on conflict (kind, reference_id) do nothing;
  get diagnostics affected = row_count;
  if affected > 0 then
    insert into public.club_wallets(user_id, balance)
      values (p_user_id, p_delta)
      on conflict (user_id) do update
        set balance = public.club_wallets.balance + excluded.balance, updated_at = now();
  end if;
  return affected > 0;
end;
$$;

revoke all on function public.credit_club_coins(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.credit_club_coins(uuid, integer, text, text) to service_role;

-- Activity rewards share a daily cap. The transaction and balance update are
-- protected by the same per-user advisory lock.
create function public.credit_club_activity_coins(
  p_user_id uuid, p_requested integer, p_reference_id text
) returns integer
language plpgsql security definer set search_path = public
as $$
declare earned integer;
declare awarded integer;
begin
  if p_requested <= 0 then raise exception 'Activity reward must be positive'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists (select 1 from public.coin_transactions where kind = 'activity' and reference_id = p_reference_id) then
    return 0;
  end if;
  select coalesce(sum(delta), 0)::integer into earned
  from public.coin_transactions
  where user_id = p_user_id and kind = 'activity'
    and created_at >= date_trunc('day', now());
  awarded := least(p_requested, greatest(0, 20 - earned));
  if awarded > 0 then
    insert into public.coin_transactions(user_id, delta, kind, reference_id)
      values (p_user_id, awarded, 'activity', p_reference_id);
    insert into public.club_wallets(user_id, balance)
      values (p_user_id, awarded)
      on conflict (user_id) do update
        set balance = public.club_wallets.balance + excluded.balance, updated_at = now();
  end if;
  return awarded;
end;
$$;

revoke all on function public.credit_club_activity_coins(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.credit_club_activity_coins(uuid, integer, text) to service_role;

-- Atomic one-time purchase. A retry returns the unchanged balance when the
-- item is already owned; insufficient funds never creates a partial row.
create function public.spend_coins_on_item(p_item_id text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare buyer uuid := auth.uid();
declare price integer;
declare remaining integer;
begin
  if buyer is null then raise exception 'Sign in required'; end if;
  price := public.club_catalog_price(p_item_id);
  if price is null then raise exception 'Unknown Club item: %', p_item_id; end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer::text, 0));

  if exists (select 1 from public.user_gallery_inventory where user_id = buyer and item_id = p_item_id) then
    select balance into remaining from public.club_wallets where user_id = buyer;
    return coalesce(remaining, 0);
  end if;

  update public.club_wallets set balance = balance - price, updated_at = now()
  where user_id = buyer and balance >= price
  returning balance into remaining;
  if remaining is null then raise exception 'Insufficient Club coins'; end if;

  insert into public.user_gallery_inventory(user_id, item_id) values (buyer, p_item_id);
  insert into public.coin_transactions(user_id, delta, kind, reference_id)
    values (buyer, -price, 'spend', buyer::text || ':' || p_item_id);
  return remaining;
end;
$$;

revoke all on function public.spend_coins_on_item(text) from public, anon;
grant execute on function public.spend_coins_on_item(text) to authenticated;

-- Likes remain backwards compatible, while active Club hangings can also be
-- liked and award one coin to an authenticated account with the same email.
create or replace function public.like_gallery_artwork(artwork_slug text, voter_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
declare voter_id uuid;
declare affected integer := 0;
begin
  if voter_email is null or voter_email <> lower(btrim(voter_email))
     or length(voter_email) > 254 or voter_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email';
  end if;
  select a.id into target_id from public.artworks a
    where a.slug = artwork_slug and (
      (a.is_selected and exists (select 1 from public.profiles p where p.id = a.profile_id and p.is_public))
      or exists (
        select 1 from public.club_gallery_hangings h
        join public.club_galleries g on g.id = h.gallery_id
        where h.artwork_id = a.id and g.status = 'active'
      )
    );
  if target_id is null then raise exception 'Artwork unavailable'; end if;
  insert into public.contacts(email, source)
    values (voter_email, 'galeria-3d') on conflict (email) do nothing;
  insert into public.artwork_likes(artwork_id, email)
    values (target_id, voter_email) on conflict (artwork_id, email) do nothing;
  get diagnostics affected = row_count;
  if affected > 0 then
    select u.id into voter_id from auth.users u where lower(u.email) = voter_email order by u.created_at limit 1;
    if voter_id is not null then
      perform public.credit_club_activity_coins(voter_id, 1, 'like:' || target_id::text || ':' || voter_id::text);
    end if;
  end if;
end;
$$;

revoke all on function public.like_gallery_artwork(text, text) from public, anon, authenticated;
grant execute on function public.like_gallery_artwork(text, text) to service_role;

-- Keep the original three-per-twelve-hours contract and add the Club reward
-- only after a new collection is inserted.
create or replace function public.collect_gallery_artwork_stamp(artwork_slug text)
returns table (status text, remaining integer, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  collector uuid := auth.uid();
  target_id uuid;
  collected_count integer;
  oldest_stamp timestamptz;
begin
  if collector is null then raise exception 'Sign in required'; end if;

  select a.id into target_id from public.artworks a
    where a.slug = artwork_slug and (
      (a.is_selected and exists (select 1 from public.profiles p where p.id = a.profile_id and p.is_public))
      or exists (
        select 1 from public.club_gallery_hangings h
        join public.club_galleries g on g.id = h.gallery_id
        where h.artwork_id = a.id and g.status = 'active'
      )
    );
  if target_id is null then raise exception 'Artwork unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(collector::text, 0));
  select count(*)::integer, min(collected_at) into collected_count, oldest_stamp
    from public.artwork_stamp_collections
    where user_id = collector and collected_at > now() - interval '12 hours';

  if exists (select 1 from public.artwork_stamp_collections where user_id = collector and artwork_id = target_id) then
    return query select 'already_collected', greatest(0, 3 - collected_count), oldest_stamp + interval '12 hours';
    return;
  end if;
  if collected_count >= 3 then
    return query select 'limit_reached', 0, oldest_stamp + interval '12 hours';
    return;
  end if;

  insert into public.artwork_stamp_collections(user_id, artwork_id) values (collector, target_id);
  perform public.credit_club_activity_coins(collector, 3, 'stamp:' || target_id::text || ':' || collector::text);
  collected_count := collected_count + 1;
  if oldest_stamp is null then oldest_stamp := now(); end if;
  return query select 'collected', 3 - collected_count, oldest_stamp + interval '12 hours';
end;
$$;

revoke all on function public.collect_gallery_artwork_stamp(text) from public, anon;
grant execute on function public.collect_gallery_artwork_stamp(text) to authenticated;

-- Digital Club subscriptions do not require a shipping address. Existing
-- physical subscriptions keep their address and still create shipments.
alter table public.subscriptions alter column shipping_address drop not null;

create or replace function public.record_paypal_subscription_payment(
  p_payment_id text, p_subscription_provider_id text, p_amount numeric, p_fee numeric, p_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare local_subscription public.subscriptions%rowtype;
declare local_payment_id uuid;
declare club_user uuid;
begin
  select * into local_subscription from public.subscriptions where provider_subscription_id = p_subscription_provider_id;
  if not found then raise exception 'subscription not found: %', p_subscription_provider_id; end if;
  select user_id into club_user from public.club_galleries where subscription_id = local_subscription.id;
  insert into public.payments(provider_payment_id, kind, subscription_id, amount, fee, currency)
  values (p_payment_id, 'subscription', local_subscription.id, p_amount, p_fee, p_currency)
  on conflict (provider_payment_id) do nothing returning id into local_payment_id;
  if local_payment_id is not null then
    if club_user is null then
      insert into public.shipments(payment_id, shipping_address) values (local_payment_id, local_subscription.shipping_address);
    else
      perform public.credit_club_coins(club_user, 1000, 'subscription_bonus', 'paypal:' || p_payment_id);
      update public.club_galleries set status = 'active', updated_at = now() where user_id = club_user;
    end if;
  end if;
  update public.subscriptions set status = 'active', updated_at = now() where id = local_subscription.id;
  return local_payment_id is not null;
end;
$$;

create or replace function public.record_subscription_payment(
  p_provider text, p_payment_id text, p_subscription_provider_id text, p_amount numeric, p_fee numeric, p_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare local_subscription public.subscriptions%rowtype;
declare local_payment_id uuid;
declare club_user uuid;
begin
  select * into local_subscription from public.subscriptions
    where provider = p_provider and provider_subscription_id = p_subscription_provider_id;
  if not found then raise exception 'subscription not found: % %', p_provider, p_subscription_provider_id; end if;
  select user_id into club_user from public.club_galleries where subscription_id = local_subscription.id;
  insert into public.payments(provider, provider_payment_id, kind, subscription_id, amount, fee, currency)
  values (p_provider, p_payment_id, 'subscription', local_subscription.id, p_amount, p_fee, p_currency)
  on conflict (provider_payment_id) do nothing returning id into local_payment_id;
  if local_payment_id is not null then
    if club_user is null then
      insert into public.shipments(payment_id, shipping_address) values (local_payment_id, local_subscription.shipping_address);
    else
      perform public.credit_club_coins(club_user, 1000, 'subscription_bonus', p_provider || ':' || p_payment_id);
      update public.club_galleries set status = 'active', updated_at = now() where user_id = club_user;
    end if;
  end if;
  update public.subscriptions set status = 'active', updated_at = now() where id = local_subscription.id;
  return local_payment_id is not null;
end;
$$;

revoke all on function public.record_paypal_subscription_payment(text, text, numeric, numeric, text) from public;
grant execute on function public.record_paypal_subscription_payment(text, text, numeric, numeric, text) to service_role;
revoke all on function public.record_subscription_payment(text, text, text, numeric, numeric, text) from public;
grant execute on function public.record_subscription_payment(text, text, text, numeric, numeric, text) to service_role;

-- Rejected, suspended or cancelled billing pauses the public gallery but
-- preserves balance, inventory, configuration and hangings.
create function public.pause_club_gallery_with_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status and new.status in ('past_due', 'suspended', 'cancelled', 'expired') then
    update public.club_galleries set status = 'paused', updated_at = now()
    where subscription_id = new.id and status <> 'paused';
  end if;
  return new;
end;
$$;

create trigger pause_club_gallery_after_subscription_change
after update of status on public.subscriptions
for each row execute function public.pause_club_gallery_with_subscription();

revoke all on function public.pause_club_gallery_with_subscription() from public, anon, authenticated;

notify pgrst, 'reload schema';
