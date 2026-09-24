// Runs the Registro Instagram migration inside a rolled-back transaction.
// node --env-file=.env.local scripts/test-registro-instagram-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260924040000_registro_instagram.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  a record; a_drive text; b_owner uuid; b_instagram text; b_drive text;
  hoy jsonb; con_a jsonb; corregida jsonb; sin_columna jsonb;
BEGIN
  -- A: an account created from the sheet (never signed in), no Instagram,
  -- and a single Registro row.
  SELECT ls.id AS legacy_id, ls.claimed_by AS owner INTO a
    FROM public.legacy_submissions ls
    JOIN public.profiles p ON p.id = ls.claimed_by
    JOIN auth.users u ON u.id = ls.claimed_by
    WHERE ls.archived_at IS NULL AND u.last_sign_in_at IS NULL AND p.instagram IS NULL
      AND (SELECT count(*) FROM public.legacy_submissions o WHERE o.email = ls.email AND o.archived_at IS NULL) = 1
    ORDER BY ls.created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No account to probe'; END IF;
  -- B: an artist whose profile already has an Instagram.
  SELECT ls.claimed_by, p.instagram, public.registro_drive_id(ls.drive_url) INTO b_owner, b_instagram, b_drive
    FROM public.legacy_submissions ls JOIN public.profiles p ON p.id = ls.claimed_by
    WHERE ls.archived_at IS NULL AND nullif(p.instagram, '') IS NOT NULL
    ORDER BY ls.created_at LIMIT 1;
  SELECT public.registro_drive_id(drive_url) INTO a_drive FROM public.legacy_submissions WHERE id = a.legacy_id;

  SELECT jsonb_agg(jsonb_build_object(
      'name', ls.name, 'email', ls.email,
      'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(ls.drive_url) || '/view',
      'country_raw', ls.country_raw, 'country_code', ls.country_code, 'title', ls.title, 'instagram', ls.instagram))
    INTO hoy FROM public.legacy_submissions ls WHERE ls.archived_at IS NULL;

  -- 1. The sheet gets A's handle, and a different one for B.
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('instagram', 'probe.handle')
      WHEN b_drive THEN e || jsonb_build_object('instagram', 'otro.handle')
      ELSE e END) INTO con_a FROM jsonb_array_elements(hoy) e;
  PERFORM public.sync_curated_registro(con_a, true);
  IF (SELECT instagram FROM public.profiles WHERE id = a.owner) IS DISTINCT FROM 'https://instagram.com/probe.handle' THEN
    RAISE EXCEPTION 'A: handle did not fill the empty profile';
  END IF;
  IF b_owner IS NOT NULL AND (SELECT instagram FROM public.profiles WHERE id = b_owner) IS DISTINCT FROM b_instagram THEN
    RAISE EXCEPTION 'B: an Instagram already on the profile was replaced';
  END IF;

  -- 2. A corrected handle follows the sheet (A never signed in).
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('instagram', 'probe.corregido') ELSE e END)
    INTO corregida FROM jsonb_array_elements(con_a) e;
  PERFORM public.sync_curated_registro(corregida, true);
  IF (SELECT instagram FROM public.profiles WHERE id = a.owner) IS DISTINCT FROM 'https://instagram.com/probe.corregido' THEN
    RAISE EXCEPTION 'A: corrected handle did not follow the sheet';
  END IF;

  -- 3. The same sheet again changes nothing.
  PERFORM public.sync_curated_registro(corregida, true);
  IF (SELECT instagram FROM public.profiles WHERE id = a.owner) IS DISTINCT FROM 'https://instagram.com/probe.corregido' THEN
    RAISE EXCEPTION 'Repeat sync is not idempotent';
  END IF;

  -- 4. A snapshot read without the Instagram column keeps stored handles.
  SELECT jsonb_agg(e - 'instagram') INTO sin_columna FROM jsonb_array_elements(corregida) e;
  PERFORM public.sync_curated_registro(sin_columna, true);
  IF (SELECT instagram FROM public.legacy_submissions WHERE id = a.legacy_id) IS DISTINCT FROM 'probe.corregido' THEN
    RAISE EXCEPTION 'Handles wiped by a snapshot without the column';
  END IF;

  -- 5. Linking an account fills an empty profile from its Registro row.
  UPDATE public.profiles SET instagram = NULL WHERE id = a.owner;
  PERFORM public.link_registro_user(a.owner);
  IF (SELECT instagram FROM public.profiles WHERE id = a.owner) IS DISTINCT FROM 'https://instagram.com/probe.corregido' THEN
    RAISE EXCEPTION 'Linking did not fill the profile Instagram';
  END IF;
END $$;
SELECT 'Registro Instagram regression tests passed' AS result;
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
