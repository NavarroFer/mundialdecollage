-- Private identities: only the server can read or write likes.
create table public.artwork_likes (
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  created_at timestamptz not null default now(),
  primary key (artwork_id, email)
);
alter table public.artwork_likes enable row level security;
revoke all on public.artwork_likes from anon, authenticated;
grant select, insert on public.artwork_likes to service_role;

-- Both writes succeed together. Repeated/concurrent requests never add a
-- second like, overwrite contact details, or resubscribe an opted-out contact.
create function public.like_gallery_artwork(artwork_slug text, voter_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  if voter_email is null or voter_email <> lower(btrim(voter_email))
     or length(voter_email) > 254 or voter_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Invalid email';
  end if;
  select a.id into target_id from public.artworks a
    join public.profiles p on p.id = a.profile_id
    where a.slug = artwork_slug and a.is_selected and p.is_public;
  if target_id is null then raise exception 'Artwork unavailable'; end if;
  insert into public.contacts(email, source)
    values (voter_email, 'galeria-3d') on conflict (email) do nothing;
  insert into public.artwork_likes(artwork_id, email)
    values (target_id, voter_email) on conflict (artwork_id, email) do nothing;
end;
$$;
revoke all on function public.like_gallery_artwork(text, text) from public, anon, authenticated;
grant execute on function public.like_gallery_artwork(text, text) to service_role;
notify pgrst, 'reload schema';
