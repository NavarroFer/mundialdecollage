// Runs the Registro titles migration inside a rolled-back transaction and
// checks how corrections in the sheet reach obras that are already public.
// node --env-file=.env.local scripts/test-registro-titles-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260923130000_registro_titles.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  a record; b record; c record;
  a_drive text; b_drive text; c_drive text;
  a_country text;
  hoy jsonb; corregida jsonb; otra jsonb; sin_titulos jsonb;
  nueva uuid;
BEGIN
  -- A and C: accounts created from the sheet that never signed in, with the
  -- name, country and artwork title the sheet gave them.
  SELECT ls.id AS legacy_id, ls.claimed_by AS owner, ls.name, ls.country_code, aw.id AS artwork_id, p.name AS profile_name
    INTO a
    FROM public.legacy_submissions ls
    JOIN public.artworks aw ON aw.legacy_submission_id = ls.id AND aw.archived_at IS NULL
    JOIN public.profiles p ON p.id = ls.claimed_by
    JOIN auth.users u ON u.id = ls.claimed_by
    WHERE ls.archived_at IS NULL AND u.last_sign_in_at IS NULL
      AND aw.title = 'Obra de ' || coalesce(ls.name, 'artista')
      AND lower(trim(p.name)) = lower(trim(ls.name))
      AND p.country_code IS NOT DISTINCT FROM ls.country_code
    ORDER BY ls.created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No account created from the sheet to probe'; END IF;
  SELECT ls.id AS legacy_id, ls.claimed_by AS owner, ls.name, p.name AS profile_name
    INTO c
    FROM public.legacy_submissions ls
    JOIN public.profiles p ON p.id = ls.claimed_by
    JOIN auth.users u ON u.id = ls.claimed_by
    WHERE ls.archived_at IS NULL AND u.last_sign_in_at IS NULL AND ls.claimed_by <> a.owner
      AND lower(trim(p.name)) = lower(trim(ls.name)) AND ls.name <> upper(ls.name)
    ORDER BY ls.created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No second account to probe'; END IF;
  -- B: an artist who already signed in; their profile is theirs.
  SELECT ls.id AS legacy_id, ls.claimed_by AS owner, p.name AS profile_name
    INTO b
    FROM public.legacy_submissions ls
    JOIN public.profiles p ON p.id = ls.claimed_by
    JOIN auth.users u ON u.id = ls.claimed_by
    WHERE ls.archived_at IS NULL AND u.last_sign_in_at IS NOT NULL
      AND lower(trim(p.name)) = lower(trim(ls.name))
    ORDER BY ls.created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No signed-in artist to probe'; END IF;

  SELECT public.registro_drive_id(drive_url) INTO a_drive FROM public.legacy_submissions WHERE id = a.legacy_id;
  SELECT public.registro_drive_id(drive_url) INTO b_drive FROM public.legacy_submissions WHERE id = b.legacy_id;
  SELECT public.registro_drive_id(drive_url) INTO c_drive FROM public.legacy_submissions WHERE id = c.legacy_id;
  a_country := CASE WHEN a.country_code = 'UY' THEN 'CL' ELSE 'UY' END;

  -- The sheet as it is today.
  SELECT jsonb_agg(jsonb_build_object(
      'name', ls.name, 'email', ls.email,
      'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(ls.drive_url) || '/view',
      'country_raw', ls.country_raw, 'country_code', ls.country_code, 'title', ls.title))
    INTO hoy FROM public.legacy_submissions ls WHERE ls.archived_at IS NULL;

  -- 1. The sheet corrects A (name, country, title), renames B, and changes
  --    only the capitalization of C.
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('name', 'Nombre Corregido', 'country_code', a_country, 'title', 'Título corregido')
      WHEN b_drive THEN e || jsonb_build_object('name', 'No debería llegar')
      WHEN c_drive THEN e || jsonb_build_object('name', upper(c.name))
      ELSE e END)
    INTO corregida FROM jsonb_array_elements(hoy) e;
  PERFORM public.sync_curated_registro(corregida, true);
  IF (SELECT name FROM public.profiles WHERE id = a.owner) <> 'Nombre Corregido' THEN RAISE EXCEPTION 'A: name did not reach the profile'; END IF;
  IF (SELECT country_code FROM public.profiles WHERE id = a.owner) IS DISTINCT FROM a_country THEN RAISE EXCEPTION 'A: country did not reach the profile'; END IF;
  IF (SELECT title FROM public.artworks WHERE id = a.artwork_id) <> 'Título corregido' THEN RAISE EXCEPTION 'A: title did not reach the artwork'; END IF;
  IF (SELECT title FROM public.legacy_submissions WHERE id = a.legacy_id) <> 'Título corregido' THEN RAISE EXCEPTION 'A: title not stored'; END IF;
  IF (SELECT name FROM public.profiles WHERE id = b.owner) <> b.profile_name THEN RAISE EXCEPTION 'B: signed-in profile overwritten'; END IF;
  IF (SELECT name FROM public.profiles WHERE id = c.owner) <> c.profile_name THEN RAISE EXCEPTION 'C: case-only change reached the profile'; END IF;

  -- 2. The same sheet again changes nothing.
  PERFORM public.sync_curated_registro(corregida, true);
  IF (SELECT name FROM public.profiles WHERE id = a.owner) <> 'Nombre Corregido'
     OR (SELECT title FROM public.artworks WHERE id = a.artwork_id) <> 'Título corregido' THEN
    RAISE EXCEPTION 'Repeat sync is not idempotent';
  END IF;

  -- 3. A title edited on the site wins over a later sheet change.
  UPDATE public.artworks SET title = 'Editado a mano' WHERE id = a.artwork_id;
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('title', 'Otro título') ELSE e END)
    INTO otra FROM jsonb_array_elements(corregida) e;
  PERFORM public.sync_curated_registro(otra, true);
  IF (SELECT title FROM public.artworks WHERE id = a.artwork_id) <> 'Editado a mano' THEN RAISE EXCEPTION 'Edited title overwritten'; END IF;
  IF (SELECT title FROM public.legacy_submissions WHERE id = a.legacy_id) <> 'Otro título' THEN RAISE EXCEPTION 'Sheet title not stored'; END IF;

  -- 4. A snapshot read without the Titulo column keeps stored titles.
  SELECT jsonb_agg(e - 'title') INTO sin_titulos FROM jsonb_array_elements(otra) e;
  PERFORM public.sync_curated_registro(sin_titulos, true);
  IF (SELECT title FROM public.legacy_submissions WHERE id = a.legacy_id) IS DISTINCT FROM 'Otro título' THEN RAISE EXCEPTION 'Titles wiped by a snapshot without the column'; END IF;

  -- 5. An artwork created from the sheet takes its title.
  UPDATE public.artworks SET legacy_submission_id = NULL, image_url = 'https://example.invalid/probe.jpg', slug = slug || '-probe'
    WHERE id = a.artwork_id;
  PERFORM public.link_registro_user(a.owner);
  SELECT id INTO nueva FROM public.artworks WHERE legacy_submission_id = a.legacy_id AND archived_at IS NULL;
  IF (SELECT title FROM public.artworks WHERE id = nueva) IS DISTINCT FROM 'Otro título' THEN RAISE EXCEPTION 'New artwork did not take the sheet title'; END IF;
END $$;
SELECT 'Registro titles regression tests passed' AS result;
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
