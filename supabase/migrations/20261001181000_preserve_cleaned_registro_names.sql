-- Registro remains the source of truth for substantive name corrections, but
-- its repeated snapshots must not undo formatting approved in the admin.
-- Keep the previous stored spelling when both values only differ by case or
-- whitespace. Renaming the implementation lets this wrapper preserve the
-- existing RPC signature used by the cron and command-line sync.
alter function public.sync_curated_registro(jsonb, boolean)
  rename to sync_curated_registro_source;

create function public.sync_curated_registro(entries jsonb, allow_large_archive boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prepared_entries jsonb;
begin
  select jsonb_agg(
    case
      when lower(regexp_replace(trim(legacy.name), '\s+', ' ', 'g')) =
           lower(regexp_replace(trim(entry.value->>'name'), '\s+', ' ', 'g'))
        then jsonb_set(entry.value, '{name}', to_jsonb(legacy.name))
      else entry.value
    end
  ) into prepared_entries
  from jsonb_array_elements(entries) as entry(value)
  left join public.legacy_submissions as legacy
    on public.registro_drive_id(entry.value->>'drive_url') = public.registro_drive_id(legacy.drive_url);

  return public.sync_curated_registro_source(prepared_entries, allow_large_archive);
end;
$$;

-- The source implementation is an internal detail; callers retain exactly
-- the original, service-role-only RPC.
revoke all on function public.sync_curated_registro_source(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.sync_curated_registro(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_curated_registro(jsonb, boolean) to service_role;
