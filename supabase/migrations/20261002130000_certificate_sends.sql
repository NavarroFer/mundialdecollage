-- The participation certificates mailed when the call closes
-- (lib/certificate-mail.ts, from /admin/convocatoria). One mail per artist,
-- ever: the row is claimed ('sending') before the Resend call, so closing
-- twice or pressing «Enviar certificados pendientes» again can't mail
-- anyone twice. 'failed' rows are retried by that button.
create table if not exists public.certificate_sends (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('sending', 'sent', 'failed')),
  error text,
  resend_email_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.certificate_sends enable row level security;
create policy "certificate_sends: admin read" on public.certificate_sends for select using (public.is_admin());
revoke all on public.certificate_sends from anon;
grant select on public.certificate_sends to authenticated;
grant select, insert, update, delete on public.certificate_sends to service_role;

-- Everyone who gets a certificate: one row per artist with a curated obra
-- (the earliest, when they have several), plus what the mail needs. The
-- address comes from their login (auth.users, Registro imports included),
-- matched to `contacts` for the unsubscribe footer.
create or replace function public.certificate_recipients()
returns table (
  profile_id uuid,
  artist_name text,
  country_code text,
  email text,
  contact_id uuid,
  subscribed boolean,
  artwork_slug text,
  artwork_title text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct on (p.id)
    p.id,
    p.name,
    p.country_code,
    lower(trim(u.email)),
    c.id,
    c.subscribed,
    a.slug,
    a.title
  from public.artworks a
  join public.profiles p on p.id = a.profile_id
  left join auth.users u on u.id = p.id
  left join public.contacts c on c.email = lower(trim(u.email))
  where a.is_selected
    and a.archived_at is null
    and a.slug is not null
    and a.image_url is not null
  order by p.id, a.created_at
$$;

revoke all on function public.certificate_recipients() from public, anon, authenticated;
grant execute on function public.certificate_recipients() to service_role;

notify pgrst, 'reload schema';
