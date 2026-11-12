-- 20261113140000_community_taste.sql rewrote like_gallery_artwork() from the
-- original 20260922130000 version and dropped what the Club added in
-- 20261029120000_club_galleries.sql: obras hung in an active Club gallery can
-- be liked, and a new like credits one Club coin to the voter's account.
-- This puts both back on top of the three-argument version, which keeps
-- recording the account (user_id) behind each like.
create or replace function public.like_gallery_artwork(
  artwork_slug text,
  voter_email text,
  voter_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  account_id uuid;
  inserted integer := 0;
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
  insert into public.artwork_likes(artwork_id, email, user_id)
    values (target_id, voter_email, voter_id)
    on conflict (artwork_id, email) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    -- Already liked: only fill in the account if the old like had none.
    if voter_id is not null then
      update public.artwork_likes set user_id = voter_id
        where artwork_id = target_id and email = voter_email and user_id is null;
    end if;
    return;
  end if;
  -- A new like earns one Club coin (daily cap inside the function). Without a
  -- session id, fall back to the account that owns the email, as before.
  account_id := voter_id;
  if account_id is null then
    select u.id into account_id from auth.users u where lower(u.email) = voter_email order by u.created_at limit 1;
  end if;
  if account_id is not null then
    perform public.credit_club_activity_coins(account_id, 1, 'like:' || target_id::text || ':' || account_id::text);
  end if;
end;
$$;

revoke all on function public.like_gallery_artwork(text, text, uuid) from public, anon, authenticated;
grant execute on function public.like_gallery_artwork(text, text, uuid) to service_role;

notify pgrst, 'reload schema';
