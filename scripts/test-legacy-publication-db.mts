// Runs against the configured database inside a rolled-back transaction.
// node --env-file=.env.local scripts/test-legacy-publication-db.mts
import {readFileSync} from 'node:fs';
const migration = readFileSync('supabase/migrations/20260922230000_prevent_duplicate_legacy_publication.sql', 'utf8');
const query = 'BEGIN;\n' + migration + `
DO $$
DECLARE kept public.artworks%rowtype; before_count integer;
BEGIN
  select * into strict kept from public.artworks where legacy_submission_id is not null and archived_at is null limit 1;
  select count(*) into before_count from public.artworks;
  insert into public.artworks(profile_id,title,slug,image_url,is_selected)
    values(kept.profile_id,kept.title,'duplicate-regression-probe',kept.image_url,true);
  if (select count(*) from public.artworks) <> before_count then
    raise exception 'Old publish action created a duplicate'; end if;
  perform public.link_registro_user(kept.profile_id);
  perform public.link_registro_user(kept.profile_id);
  if (select count(*) from public.artworks) <> before_count then
    raise exception 'Repeated linking created a duplicate'; end if;
  update public.artworks set archived_at = null, is_selected = true where duplicate_of is not null;
  if exists(select 1 from public.artworks where duplicate_of is not null and (archived_at is null or is_selected)) then
    raise exception 'Sync restored an archived duplicate'; end if;
  begin
    update public.legacy_submissions set archived_at = null where lower(email) = 'mailer-daemon@googlemail.com';
    raise exception 'Bounce restored';
  exception when raise_exception then
    if SQLERRM = 'Bounce restored' then raise; end if;
  end;
END $$;

SELECT 'Legacy publication regression tests passed' AS result;
ROLLBACK;`;
const r=await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(45000)});const body=await r.text();if(!r.ok)throw Error(body);console.log(body);
