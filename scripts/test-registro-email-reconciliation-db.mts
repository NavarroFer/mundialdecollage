// Runs the email-reconciliation migration in a rolled-back transaction.
// node --env-file=.env.local scripts/test-registro-email-reconciliation-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260930010000_reconcile_registro_email_changes.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  snapshot jsonb;
  source_id uuid := 'fd512bcf-4295-4757-aef2-9d764e8ff146'::uuid;
  target_id uuid := 'b62f01d9-e50d-4452-ad80-fb416bd92c00'::uuid;
BEGIN
  SELECT jsonb_build_array(jsonb_build_object(
    'name', name,
    'email', CASE WHEN id = source_id THEN 'carlosenriquegozaloara@gmail.com' ELSE email END,
    'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(drive_url) || '/view',
    'country_raw', country_raw, 'country_code', country_code, 'title', title, 'instagram', instagram
  )) INTO snapshot FROM public.legacy_submissions WHERE id = source_id;

  PERFORM public.sync_curated_registro(snapshot, true);
  IF (SELECT claimed_by FROM public.legacy_submissions WHERE id = source_id) IS DISTINCT FROM target_id THEN
    RAISE EXCEPTION 'Expected claimed owner transfer';
  END IF;
  IF (SELECT profile_id FROM public.artworks WHERE legacy_submission_id = source_id) IS DISTINCT FROM target_id THEN
    RAISE EXCEPTION 'Expected artwork owner transfer';
  END IF;
  IF (SELECT email FROM public.legacy_submissions WHERE id = source_id) IS DISTINCT FROM 'carlosenriquegozaloara@gmail.com' THEN
    RAISE EXCEPTION 'Expected email update';
  END IF;
END $$;
SELECT 'Registro email reconciliation regression test passed' AS result;
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
