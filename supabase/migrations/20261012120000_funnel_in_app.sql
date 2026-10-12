-- Which app's browser each circuit step came from (lib/in-app-browser.ts):
-- Instagram's and Facebook's own browsers are where sign-in and the file
-- picker fail most, so /admin/estadisticas can show any funnel for them
-- alone. Null is any other browser, and every step before this column.
alter table public.funnel_events
  add column if not exists in_app text check (in_app in ('instagram', 'facebook'));

-- funnel_summary, for one kind of browser: 'instagram', 'facebook' or
-- 'other' (anything else, including steps from before in_app existed).
-- Runs with the caller's rights, so only admins get rows back.
create or replace function public.funnel_summary_by_browser(since timestamptz, browser text)
returns table (name text, visitors bigint, events bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select e.name, count(distinct e.visitor_id), count(*)
  from public.funnel_events e
  where e.created_at >= since
    and case browser
      when 'other' then e.in_app is null
      else e.in_app = browser
    end
  group by e.name
$$;

revoke all on function public.funnel_summary_by_browser(timestamptz, text) from public, anon;
grant execute on function public.funnel_summary_by_browser(timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';
