-- Daily series for the admin dashboard. It keeps the aggregation in Postgres
-- so the UI never has to download raw visitor identifiers.
create or replace function public.funnel_daily_summary(since timestamptz, event_name text)
returns table (day date, visitors bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (e.created_at at time zone 'America/Argentina/Buenos_Aires')::date as day,
    count(distinct e.visitor_id) as visitors
  from public.funnel_events e
  where e.created_at >= since and e.name = event_name
  group by 1
  order by 1
$$;

revoke all on function public.funnel_daily_summary(timestamptz, text) from public, anon;
grant execute on function public.funnel_daily_summary(timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';
