// Tests the actual migration + source snapshot in a rolled-back transaction.
// node --env-file=.env.local scripts/test-registro-db.mts /path/to/entries.json
import { readFileSync } from 'node:fs'
const entries = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const migration = readFileSync('supabase/migrations/20260921120000_registro_sync.sql', 'utf8')
const literal = JSON.stringify(entries).replaceAll("'", "''")
const query = `BEGIN;
${migration}
SELECT public.sync_curated_registro('${literal}'::jsonb, true);
DO $$
DECLARE actor uuid; result jsonb; before_count integer; probe uuid;
BEGIN
  IF (SELECT count(*) FROM public.legacy_submissions WHERE archived_at IS NULL) <> ${entries.length} THEN
    RAISE EXCEPTION 'Source count mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM public.legacy_submissions ls JOIN auth.users u ON lower(trim(u.email)) = ls.email
            WHERE ls.archived_at IS NULL AND u.email_confirmed_at IS NOT NULL AND ls.claimed_by IS DISTINCT FROM u.id) THEN
    RAISE EXCEPTION 'Verified user has unlinked works';
  END IF;
  IF EXISTS(SELECT 1 FROM public.legacy_submissions ls WHERE ls.archived_at IS NULL AND ls.claimed_by IS NOT NULL
            AND ls.image_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.artworks a
                WHERE a.legacy_submission_id = ls.id AND a.profile_id = ls.claimed_by AND a.archived_at IS NULL)) THEN
    RAISE EXCEPTION 'A linked image has no owner artwork';
  END IF;
  IF has_function_privilege('authenticated', 'public.sync_curated_registro(jsonb,boolean)', 'EXECUTE') OR
     has_function_privilege('authenticated', 'public.link_registro_user(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Privileged RPC exposed';
  END IF;
  SELECT count(*) INTO before_count FROM public.artworks;
  result := public.sync_curated_registro('${literal}'::jsonb, true);
  IF (result->>'inserted')::integer <> 0 OR (result->>'archived')::integer <> 0
     OR (SELECT count(*) FROM public.artworks) <> before_count THEN
    RAISE EXCEPTION 'Repeat run is not idempotent';
  END IF;
  -- Existing records stay within this rolled-back transaction. No accounts
  -- are created, no email is sent, and original verification is restored.
  SELECT id INTO actor FROM auth.users WHERE email_confirmed_at IS NOT NULL LIMIT 1;
  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = actor;
  INSERT INTO public.legacy_submissions(email, name, drive_url)
    SELECT lower(email), 'Rollback probe', 'https://drive.google.com/file/d/REGISTRO_TEST_PROBE/view'
    FROM auth.users WHERE id = actor RETURNING id INTO probe;
  PERFORM public.link_registro_user(actor);
  IF (SELECT claimed_by FROM public.legacy_submissions WHERE id = probe) IS NOT NULL THEN
    RAISE EXCEPTION 'Unverified account claimed a work';
  END IF;
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = actor;
  IF (SELECT claimed_by FROM public.legacy_submissions WHERE id = probe) IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Registration trigger did not link pending work';
  END IF;
END $$;
SELECT jsonb_build_object('passed', true, 'source_rows', ${entries.length}, 'checks',
  'count, all verified ownership, all linked images, RPC permissions, repeat idempotency, unverified rejection, verification trigger') AS test_result;
ROLLBACK;`
const response = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const body = await response.text()
if (!response.ok) throw new Error(body)
console.log(body)
