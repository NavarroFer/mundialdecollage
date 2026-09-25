-- Comments on the obras in the 3D gallery. Anyone signed in with Google can
-- write one; it stays 'pending' (visible only to its author) until an admin
-- approves it from /admin/comentarios. Every read and write for visitors
-- goes through server actions with the service role (app/galeria-3d/
-- actions.ts), so author emails and user ids never reach the browser.
create table if not exists public.artwork_comments (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  -- Only for moderation context (/admin/comentarios); never shown publicly.
  author_email text,
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists artwork_comments_artwork_idx on public.artwork_comments (artwork_id, status, created_at);
create index if not exists artwork_comments_user_idx on public.artwork_comments (user_id, created_at);
create index if not exists artwork_comments_pending_idx on public.artwork_comments (created_at) where status = 'pending';

alter table public.artwork_comments enable row level security;

create policy "artwork_comments: admin all" on public.artwork_comments
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.artwork_comments from anon;
grant select, update, delete on public.artwork_comments to authenticated;
grant select, insert, update, delete on public.artwork_comments to service_role;

-- When an artist loaded from Registro (their artwork has a
-- legacy_submission_id) confirmed their name and country themselves — until
-- then the home asks them to (components/participation-status.tsx).
alter table public.profiles add column if not exists details_confirmed_at timestamptz;

notify pgrst, 'reload schema';
