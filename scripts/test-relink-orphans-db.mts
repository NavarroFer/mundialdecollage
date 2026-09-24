// Runs the orphaned-artwork relink migration inside a rolled-back
// transaction and checks that syncs stop publishing copies.
// node --env-file=.env.local scripts/test-relink-orphans-db.mts
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/20260924020000_relink_orphaned_registro_artworks.sql', 'utf8')
const query = `BEGIN;
${migration}
DO $$
DECLARE
  hoy jsonb; antes integer; p record; nueva uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM public.artworks WHERE id IN ('08e0b898-4d79-43e5-87df-922b4a99bd0f', 'f11b6cb8-a183-4244-9363-893aa9c50c55')) THEN
    RAISE EXCEPTION 'Copies still there';
  END IF;
  IF (SELECT legacy_submission_id FROM public.artworks WHERE id = '7cdb15cc-c2fa-4954-86b8-5e716794dd88') IS DISTINCT FROM '1337a7b3-ba79-41df-8529-4980102aca2e' THEN
    RAISE EXCEPTION 'Original not linked to its row';
  END IF;

  -- A full sync with the sheet as it is today creates no artworks.
  SELECT jsonb_agg(jsonb_build_object(
      'name', ls.name, 'email', ls.email,
      'drive_url', 'https://drive.google.com/file/d/' || public.registro_drive_id(ls.drive_url) || '/view',
      'country_raw', ls.country_raw, 'country_code', ls.country_code, 'title', ls.title))
    INTO hoy FROM public.legacy_submissions ls WHERE ls.archived_at IS NULL;
  SELECT count(*) INTO antes FROM public.artworks;
  PERFORM public.sync_curated_registro(hoy, true);
  IF (SELECT count(*) FROM public.artworks) <> antes THEN
    RAISE EXCEPTION 'Sync still created % artworks', (SELECT count(*) FROM public.artworks) - antes;
  END IF;

  -- An artwork that loses its row again is relinked, not copied.
  SELECT a.id, a.profile_id, a.legacy_submission_id AS fila INTO p
    FROM public.artworks a WHERE a.id = 'c436a66f-074b-4426-9b85-fd838d3005e0';
  UPDATE public.artworks SET legacy_submission_id = NULL WHERE id = p.id;
  PERFORM public.link_registro_user(p.profile_id);
  IF (SELECT legacy_submission_id FROM public.artworks WHERE id = p.id) IS DISTINCT FROM p.fila
     OR (SELECT count(*) FROM public.artworks WHERE profile_id = p.profile_id) <> 1 THEN
    RAISE EXCEPTION 'Orphan was copied instead of relinked';
  END IF;

  -- Two orphaned artworks are ambiguous: the row gets its own artwork.
  UPDATE public.artworks SET legacy_submission_id = NULL WHERE id = p.id;
  INSERT INTO public.artworks(profile_id, title, slug, image_url, is_selected)
    VALUES(p.profile_id, 'Otra obra', 'relink-probe-' || p.id::text, 'https://example.invalid/otra.jpg', false);
  PERFORM public.link_registro_user(p.profile_id);
  SELECT id INTO nueva FROM public.artworks WHERE legacy_submission_id = p.fila;
  IF nueva IS NULL OR nueva = p.id THEN RAISE EXCEPTION 'Ambiguous case should not relink'; END IF;
END $$;
SELECT 'Relink regression tests passed' AS result;
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
