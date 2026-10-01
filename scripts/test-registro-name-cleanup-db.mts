// Runs the durable-name-cleanup migration in a rolled-back transaction.
// node --env-file=.env.local scripts/test-registro-name-cleanup-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20261001181000_preserve_cleaned_registro_names.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  target_id uuid;
  target_drive text;
  snapshot jsonb;
BEGIN
  SELECT id INTO target_id FROM public.legacy_submissions
    WHERE archived_at IS NULL AND nullif(trim(name), '') IS NOT NULL
    ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No Registro row available for name-cleanup probe'; END IF;
  SELECT public.registro_drive_id(drive_url) INTO target_drive
    FROM public.legacy_submissions WHERE id = target_id;

  UPDATE public.legacy_submissions SET name = 'Gaby López' WHERE id = target_id;
  SELECT jsonb_agg(jsonb_build_object(
    'name', CASE WHEN id = target_id THEN '  GABY   LÓPEZ  ' ELSE name END,
    'email', email,
    'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(drive_url) || '/view',
    'country_raw', country_raw, 'country_code', country_code, 'title', title, 'instagram', instagram
  )) INTO snapshot FROM public.legacy_submissions WHERE archived_at IS NULL;

  PERFORM public.sync_curated_registro(snapshot, true);
  IF (SELECT name FROM public.legacy_submissions WHERE id = target_id) IS DISTINCT FROM 'Gaby López' THEN
    RAISE EXCEPTION 'A repeated Registro sync reverted approved name formatting';
  END IF;

  SELECT jsonb_agg(CASE WHEN public.registro_drive_id(value->>'drive_url') = target_drive
    THEN jsonb_set(value, '{name}', '"Gabriela López"'::jsonb)
    ELSE value END) INTO snapshot FROM jsonb_array_elements(snapshot) AS entry(value);
  PERFORM public.sync_curated_registro(snapshot, true);
  IF (SELECT name FROM public.legacy_submissions WHERE id = target_id) IS DISTINCT FROM 'Gabriela López' THEN
    RAISE EXCEPTION 'A substantive name correction from Registro was ignored';
  END IF;
END $$;
SELECT 'Registro name-cleanup persistence regression test passed' AS result;
ROLLBACK;`

const response = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
  signal: AbortSignal.timeout(120_000),
})
const body = await response.text()
if (!response.ok) throw new Error(body)
console.log(body)
