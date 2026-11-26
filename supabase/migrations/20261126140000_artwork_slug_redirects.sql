-- Obra slugs longer than 80 characters (one artist pasted the whole
-- description as the title): the slug is the file name of the page in Next's
-- cache, past the 255-byte limit that page can't be cached (ENAMETOOLONG)
-- and is drawn anew on every visit. New ones are capped in the app
-- (lib/slug.ts, boundedSlug); this shortens the existing ones the same way,
-- cut at the last whole word, and keeps each old slug so its links still
-- lead to the obra: /obras/<old> redirects (lib/finalists.ts,
-- getRenamedArtworkSlug) and a certificate link signed for the old slug
-- still opens.
create table if not exists public.artwork_slug_redirects (
  old_slug text primary key,
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.artwork_slug_redirects enable row level security;
revoke all on public.artwork_slug_redirects from anon, authenticated;
grant select, insert, update, delete on public.artwork_slug_redirects to service_role;

-- Where an old slug leads now. Only the slug: whether that obra can be seen
-- is up to its own page.
create or replace function public.renamed_artwork_slug(old text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.slug from public.artwork_slug_redirects r
  join public.artworks a on a.id = r.artwork_id
  where r.old_slug = old;
$$;

revoke all on function public.renamed_artwork_slug(text) from public;
grant execute on function public.renamed_artwork_slug(text) to anon, authenticated, service_role;

do $$
declare
  item record;
  base text;
  candidate text;
  suffix integer;
begin
  for item in select id, slug from public.artworks where length(slug) > 80 order by created_at, id loop
    base := left(item.slug, 81);
    base := case when strpos(base, '-') > 0 and length(item.slug) > 80
      then regexp_replace(base, '-[^-]*$', '') else left(item.slug, 80) end;
    base := regexp_replace(base, '-+$', '');
    candidate := base;
    suffix := 2;
    while exists (select 1 from public.artworks where slug = candidate)
       or exists (select 1 from public.artwork_slug_redirects where old_slug = candidate) loop
      candidate := base || '-' || suffix;
      suffix := suffix + 1;
    end loop;
    insert into public.artwork_slug_redirects (old_slug, artwork_id) values (item.slug, item.id)
      on conflict (old_slug) do nothing;
    update public.artworks set slug = candidate where id = item.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
