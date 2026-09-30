-- Historical intake counts for the admin dashboard. Keep the definition in
-- sync with get_total_submissions_count(): a Registro row is one received
-- work, and a native entry without a Registro counterpart is another one.
create or replace function public.submission_history(since timestamptz, grouping text)
returns table (bucket date, works bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  with settings as (
    select
      case when grouping in ('day', 'week', 'month') then grouping else 'day' end as resolution,
      'America/Argentina/Buenos_Aires'::text as timezone
  ),
  bounds as (
    select
      date_trunc(resolution, since at time zone timezone)::date as first_bucket,
      date_trunc(resolution, now() at time zone timezone)::date as last_bucket,
      case resolution
        when 'month' then interval '1 month'
        when 'week' then interval '1 week'
        else interval '1 day'
      end as step,
      resolution,
      timezone
    from settings
  ),
  received as (
    select created_at from public.legacy_submissions
    where archived_at is null and created_at >= since
    union all
    select created_at from public.artworks
    where archived_at is null
      and is_entered = true
      and legacy_submission_id is null
      and created_at >= since
  ),
  totals as (
    select date_trunc(bounds.resolution, received.created_at at time zone bounds.timezone)::date as bucket, count(*)::bigint as works
    from received cross join bounds
    group by 1
  )
  select series.bucket::date, coalesce(totals.works, 0)::bigint
  from bounds
  cross join lateral generate_series(bounds.first_bucket::timestamp, bounds.last_bucket::timestamp, bounds.step) as series(bucket)
  left join totals on totals.bucket = series.bucket::date
  order by 1
$$;

revoke all on function public.submission_history(timestamptz, text) from public, anon;
grant execute on function public.submission_history(timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';
