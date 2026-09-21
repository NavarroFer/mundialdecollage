-- Archived rows remain recoverable by service-role syncs, but disappear
-- from every session-backed application path immediately.
drop policy if exists "legacy_submissions: admin only" on public.legacy_submissions;
create policy "legacy_submissions: admin only" on public.legacy_submissions
  for all to authenticated
  using (public.is_admin() and archived_at is null)
  with check (public.is_admin());

drop policy if exists "legacy_submissions: read own unclaimed" on public.legacy_submissions;
create policy "legacy_submissions: read own unclaimed"
  on public.legacy_submissions for select to authenticated
  using (
    archived_at is null
    and claimed_by is null
    and selected = true
    and email = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "legacy_submissions: claim own unclaimed" on public.legacy_submissions;
create policy "legacy_submissions: claim own unclaimed"
  on public.legacy_submissions for update to authenticated
  using (
    archived_at is null
    and claimed_by is null
    and selected = true
    and email = lower(auth.jwt() ->> 'email')
  )
  with check (claimed_by = auth.uid() and archived_at is null);

notify pgrst, 'reload schema';
