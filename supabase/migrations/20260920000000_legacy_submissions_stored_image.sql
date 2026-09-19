-- Copies each legacy obra's Drive photo into our own storage as soon as it's
-- imported (see fetchLegacyImagesBatch / storeLegacyArtworkGlobally), instead
-- of only fetching it lazily whenever that artist happens to register. A
-- Drive link isn't a safe long-term reference — the file can be unshared,
-- deleted, or Drive itself can be briefly unreachable — so the artwork needs
-- its own durable copy here regardless of whether/when someone registers.
--
-- image_fetch_failed_at marks a row the batch already tried and couldn't
-- fetch (private file, broken link, non-image response) so it's skipped on
-- later batch runs instead of being retried forever and blocking progress on
-- rows further back in the queue.
alter table public.legacy_submissions
  add column if not exists image_path text,
  add column if not exists image_url text,
  add column if not exists image_fetch_failed_at timestamptz;
