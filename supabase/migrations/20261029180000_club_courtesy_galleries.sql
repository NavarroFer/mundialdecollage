-- Club del Mundial: complimentary galleries for the founders. An admin turns
-- an artist's gallery on without a subscription and can gift coins with it.
-- The gallery stays active until an admin ends the courtesy; a billing
-- change on a subscription the gallery was linked to before never pauses it.

alter table public.club_galleries
  add column courtesy_granted_at timestamptz;

alter table public.coin_transactions drop constraint coin_transactions_kind_check;
alter table public.coin_transactions add constraint coin_transactions_kind_check
  check (kind in ('subscription_bonus', 'purchase', 'activity', 'achievement', 'gift', 'spend', 'refund'));

create or replace function public.credit_club_coins(
  p_user_id uuid, p_delta integer, p_kind text, p_reference_id text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare affected integer := 0;
begin
  if p_delta <= 0 then raise exception 'Coin credit must be positive'; end if;
  if p_kind not in ('subscription_bonus', 'purchase', 'activity', 'achievement', 'gift', 'refund') then
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

create or replace function public.pause_club_gallery_with_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status and new.status in ('past_due', 'suspended', 'cancelled', 'expired') then
    update public.club_galleries set status = 'paused', updated_at = now()
    where subscription_id = new.id and status <> 'paused' and courtesy_granted_at is null;
  end if;
  return new;
end;
$$;

-- The account behind an email, for the admin form. Null name when the
-- person signed in but never filled in their profile.
create function public.admin_club_account(p_email text)
returns table (user_id uuid, name text)
language sql stable security definer set search_path = public
as $$
  select u.id, coalesce(nullif(btrim(p.name), ''), nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_admin() and lower(u.email) = lower(btrim(p_email))
  order by u.created_at
  limit 1
$$;

-- Turns the artist's gallery on as a courtesy and gifts p_coins once per
-- p_reference (the form sends a fresh one each time it is drawn, so a double
-- click gifts once). An existing draft or paused gallery keeps its settings
-- and hangings; a paying member is left alone. The outcome is 'created',
-- 'reactivated', 'already_courtesy' (only the coins are added) or 'paying',
-- with the slug of the gallery it refers to.
create function public.grant_club_courtesy_gallery(
  p_user_id uuid, p_slug text, p_title text, p_host_avatar_id text, p_coins integer, p_reference text
) returns table (outcome text, gallery_slug text)
language plpgsql security definer set search_path = public
as $$
declare current_gallery public.club_galleries%rowtype;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_coins is null or p_coins not between 0 and 100000 then raise exception 'Invalid coin gift'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into current_gallery from public.club_galleries where user_id = p_user_id for update;

  if not found then
    insert into public.club_galleries(user_id, slug, title, host_avatar_id, status, courtesy_granted_at)
      values (p_user_id, p_slug, p_title, p_host_avatar_id, 'active', now());
    outcome := 'created';
    gallery_slug := p_slug;
  elsif current_gallery.courtesy_granted_at is not null then
    outcome := 'already_courtesy';
    gallery_slug := current_gallery.slug;
  elsif current_gallery.status = 'active' then
    outcome := 'paying';
    gallery_slug := current_gallery.slug;
    return next;
    return;
  else
    update public.club_galleries set status = 'active', courtesy_granted_at = now()
      where id = current_gallery.id;
    outcome := 'reactivated';
    gallery_slug := current_gallery.slug;
  end if;

  if p_coins > 0 then
    perform public.credit_club_coins(p_user_id, p_coins, 'gift', 'cortesia:' || p_reference);
  end if;
  return next;
end;
$$;

-- Ends a courtesy. The gallery stays on only when the member is also paying
-- an active subscription; otherwise it is paused, with everything kept.
-- Returns the gallery's slug, or null when it was not a courtesy.
create function public.end_club_courtesy(p_gallery_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare ended_slug text;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  update public.club_galleries g
    set courtesy_granted_at = null,
        status = case when exists (
          select 1 from public.subscriptions s where s.id = g.subscription_id and s.status = 'active'
        ) then 'active' else 'paused' end
    where g.id = p_gallery_id and g.courtesy_granted_at is not null
    returning g.slug into ended_slug;
  return ended_slug;
end;
$$;

-- Every gallery with its owner, billing and coins, for /admin/club.
create function public.admin_club_galleries()
returns table (
  id uuid, slug text, title text, status text, email text, courtesy_granted_at timestamptz,
  subscription_status text, balance integer, hung integer, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.slug, g.title, g.status, u.email, g.courtesy_granted_at, s.status,
    coalesce(w.balance, 0),
    (select count(*)::integer from public.club_gallery_hangings h where h.gallery_id = g.id),
    g.created_at
  from public.club_galleries g
  join auth.users u on u.id = g.user_id
  left join public.subscriptions s on s.id = g.subscription_id
  left join public.club_wallets w on w.user_id = g.user_id
  where public.is_admin()
  order by g.created_at desc
$$;

revoke all on function public.admin_club_account(text) from public, anon;
revoke all on function public.grant_club_courtesy_gallery(uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.end_club_courtesy(uuid) from public, anon;
revoke all on function public.admin_club_galleries() from public, anon;
grant execute on function public.admin_club_account(text) to authenticated;
grant execute on function public.grant_club_courtesy_gallery(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.end_club_courtesy(uuid) to authenticated;
grant execute on function public.admin_club_galleries() to authenticated;

notify pgrst, 'reload schema';
