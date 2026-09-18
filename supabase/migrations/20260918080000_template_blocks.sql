-- Backs the visual (block-based) email editor: templates/campaigns keep
-- body_html as the source Resend actually sends (nothing about sending
-- changes), plus an optional body_json snapshot of the block structure that
-- produced it, so re-opening a template in the editor doesn't require
-- reverse-parsing HTML. Null body_json means "written with the old raw-HTML
-- textarea" — those keep opening in the legacy fallback.
alter table public.templates
  add column if not exists body_json jsonb;

alter table public.campaigns
  add column if not exists body_json jsonb;

-- Image blocks upload straight from the admin editor to Storage (same
-- direct-to-Storage pattern as the `artworks` bucket in
-- 20260917020000_submission_fields.sql, sidestepping Vercel's ~4.5MB request
-- body cap). Public read so Resend/email clients can fetch the image with no
-- auth; writes are admin-only since this bucket only backs the mailing UI.
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do nothing;

create policy "email-assets: public read"
  on storage.objects for select
  using (bucket_id = 'email-assets');

create policy "email-assets: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'email-assets' and public.is_admin());

create policy "email-assets: admin update"
  on storage.objects for update
  using (bucket_id = 'email-assets' and public.is_admin());

create policy "email-assets: admin delete"
  on storage.objects for delete
  using (bucket_id = 'email-assets' and public.is_admin());
