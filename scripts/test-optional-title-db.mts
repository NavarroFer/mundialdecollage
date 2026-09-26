// Runs the optional-title migration inside a rolled-back transaction and
// checks the cleanup and how Registro treats an obra without a title.
// node --env-file=.env.local scripts/test-optional-title-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260926120000_optional_artwork_title.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  a record;
  a_drive text;
  hoy jsonb; nueva jsonb;
  nueva_obra uuid;
BEGIN
  -- 1. Cleanup: no invented titles left, known fixes in place.
  IF EXISTS(SELECT 1 FROM public.artworks WHERE title LIKE 'Obra de %') THEN RAISE EXCEPTION 'Automatic titles left'; END IF;
  IF (SELECT title FROM public.artworks WHERE id = 'c1de8a79-b25d-4657-8c6f-7fab48093415') IS DISTINCT FROM 'sin travestis no hay paraíso' THEN
    RAISE EXCEPTION 'Otto Maciel title not fixed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.artworks WHERE title = 'provincia: Entre Ríos') THEN RAISE EXCEPTION 'Province title left'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE name = '*Omar Moreno*' AND details_confirmed_at IS NULL) THEN RAISE EXCEPTION 'Name not fixed'; END IF;

  -- An obra from the sheet with a title there.
  SELECT ls.id AS legacy_id, ls.claimed_by AS owner, ls.title, aw.id AS artwork_id
    INTO a
    FROM public.legacy_submissions ls
    JOIN public.artworks aw ON aw.legacy_submission_id = ls.id AND aw.archived_at IS NULL
    WHERE ls.archived_at IS NULL AND ls.title IS NOT NULL AND aw.title = ls.title
    ORDER BY ls.created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No titled obra to probe'; END IF;
  SELECT public.registro_drive_id(drive_url) INTO a_drive FROM public.legacy_submissions WHERE id = a.legacy_id;

  SELECT jsonb_agg(jsonb_build_object(
      'name', ls.name, 'email', ls.email,
      'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(ls.drive_url) || '/view',
      'country_raw', ls.country_raw, 'country_code', ls.country_code, 'title', ls.title))
    INTO hoy FROM public.legacy_submissions ls WHERE ls.archived_at IS NULL;

  -- 2. A title cleared on the site stays empty while the sheet keeps the
  --    same (wrong) value.
  UPDATE public.artworks SET title = NULL WHERE id = a.artwork_id;
  PERFORM public.sync_curated_registro(hoy, true);
  IF (SELECT title FROM public.artworks WHERE id = a.artwork_id) IS NOT NULL THEN RAISE EXCEPTION 'Cleared title refilled with the old value'; END IF;

  -- 3. Once the sheet brings a new title, the empty obra takes it.
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('title', 'Título nuevo') ELSE e END)
    INTO nueva FROM jsonb_array_elements(hoy) e;
  PERFORM public.sync_curated_registro(nueva, true);
  IF (SELECT title FROM public.artworks WHERE id = a.artwork_id) IS DISTINCT FROM 'Título nuevo' THEN RAISE EXCEPTION 'New sheet title did not fill the empty obra'; END IF;

  -- 4. A title the artist wrote wins over a later sheet change.
  UPDATE public.artworks SET title = 'Escrito por el artista' WHERE id = a.artwork_id;
  SELECT jsonb_agg(CASE public.registro_drive_id(e->>'drive_url')
      WHEN a_drive THEN e || jsonb_build_object('title', 'Otro más') ELSE e END)
    INTO nueva FROM jsonb_array_elements(hoy) e;
  PERFORM public.sync_curated_registro(nueva, true);
  IF (SELECT title FROM public.artworks WHERE id = a.artwork_id) IS DISTINCT FROM 'Escrito por el artista' THEN RAISE EXCEPTION 'Artist title overwritten'; END IF;

  -- 5. An obra created from a sheet row without a title has no title, not
  --    an invented one.
  UPDATE public.legacy_submissions SET title = NULL WHERE id = a.legacy_id;
  DELETE FROM public.artworks WHERE id = a.artwork_id;
  PERFORM public.link_registro_user(a.owner);
  SELECT id INTO nueva_obra FROM public.artworks WHERE legacy_submission_id = a.legacy_id AND archived_at IS NULL;
  IF nueva_obra IS NULL THEN RAISE EXCEPTION 'Obra not recreated'; END IF;
  IF (SELECT title FROM public.artworks WHERE id = nueva_obra) IS NOT NULL THEN RAISE EXCEPTION 'Invented a title'; END IF;
END $$;
SELECT 'Optional title tests passed' AS result;
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
