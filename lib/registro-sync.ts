import type { SupabaseClient } from '@supabase/supabase-js'
import { driveFileId, parseRegistro, planRegistro, type RegistroCell } from '@/lib/registro'
import { guessCountryCodeFromName } from '@/lib/participants'
import { storeLegacyArtworkGlobally } from '@/lib/legacy-submissions'
import { reuseRegistroArtwork } from '@/lib/reuse-registro-artwork'
import { publishPendingLegacySubmissions } from '@/lib/publish-legacy'

// Shared by scripts/sync-registro.mts and the /api/cron/registro job so both
// validate, back up, archive and fetch images exactly the same way.

export function parseRegistroWithCountries(rows: RegistroCell[][]) {
  return parseRegistro(rows).map((entry) => ({
    ...entry,
    country_code: entry.country_raw ? guessCountryCodeFromName(entry.country_raw) ?? null : null,
  }))
}

export async function readAll(db: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from(table).select('*').order('id').range(from, from + 499)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export type RegistroSyncOptions = {
  apply: boolean
  allowLargeArchive?: boolean
  // Persists the pre-mutation backup and returns where it went. Runs before
  // any write; a throw aborts the sync.
  saveBackup: (backup: Record<string, unknown>) => Promise<string>
  // Image downloads stop starting new batches after this timestamp; the rest
  // stay pending and are retried on the next run.
  imageDeadline?: number
  log?: (line: Record<string, unknown>) => void
  // false once the call is closed (/admin/convocatoria): rows the sheet gains
  // afterwards aren't added; the ones already known keep syncing.
  allowNew?: boolean
}

export type RegistroSyncReport = {
  mode: 'dry-run' | 'apply'
  total: number
  contacts: number
  insert: number
  restore: number
  archive: number
  result?: unknown
  backupPath?: string
  images?: { pending: number; downloaded: number; failed: number; reused: number; deferred: number; failedRows: { id: string; name: string | null; drive_url: string }[] }
  published?: { accounts: number; skipped: string[] }
  verifiedActive?: number
}

export async function syncRegistro(db: SupabaseClient, rows: RegistroCell[][], options: RegistroSyncOptions): Promise<RegistroSyncReport> {
  const log = options.log ?? (() => {})
  const existing = await readAll(db, 'legacy_submissions')
  const known = new Set((existing as { drive_url: string | null }[]).flatMap((row) => {
    const id = row.drive_url ? driveFileId(row.drive_url) : null
    return id ? [id] : []
  }))
  const entries = parseRegistroWithCountries(rows).filter((entry) => {
    if (options.allowNew !== false) return true
    const id = driveFileId(entry.drive_url)
    return Boolean(id && known.has(id))
  })
  const plan = planRegistro(entries, existing as { id: string; drive_url: string; archived_at: string | null }[])
  const report: RegistroSyncReport = { mode: options.apply ? 'apply' : 'dry-run', ...plan, archive: plan.archive.length }
  log({ ...report })
  if (!options.apply) return report

  // A backup precedes every database mutation; it includes all fields needed
  // to restore ownership, selections and subscription state.
  const backup: Record<string, unknown> = { entries, legacy_submissions: existing }
  for (const table of ['artworks', 'profiles', 'contacts']) backup[table] = await readAll(db, table)
  report.backupPath = await options.saveBackup(backup)

  const { data, error } = await db.rpc('sync_curated_registro', {
    entries,
    allow_large_archive: options.allowLargeArchive ?? false,
  })
  if (error) throw new Error(`Sincronización rechazada: ${error.message} (plan: ${JSON.stringify({ ...plan, archive: plan.archive.length })})`)
  report.result = data
  log({ result: data, backupPath: report.backupPath })

  // Reuse the same image validation, size limits and JPEG optimization as
  // /admin/obras. Retry failed photos next run without re-inserting the row.
  const current = await readAll(db, 'legacy_submissions')
  const pending = current.filter((row) => !row.archived_at && !row.image_url)
  const images = { pending: pending.length, downloaded: 0, failed: 0, reused: 0, deferred: 0, failedRows: [] as { id: string; name: string | null; drive_url: string }[] }
  for (let i = 0; i < pending.length; i += 4) {
    if (options.imageDeadline && Date.now() > options.imageDeadline) {
      images.deferred = pending.length - i
      break
    }
    await Promise.all(pending.slice(i, i + 4).map(async (row) => {
      const result = await storeLegacyArtworkGlobally(db, { id: String(row.id), drive_url: String(row.drive_url) })
      if (result && await reuseRegistroArtwork(db, { id: String(row.id), claimed_by: row.claimed_by as string | null }, result.fingerprint)) images.reused++
      const { error: imageError } = await db.from('legacy_submissions').update(result
        ? { image_path: result.path, image_url: result.publicUrl, image_fetch_failed_at: null }
        : { image_fetch_failed_at: new Date().toISOString() }).eq('id', row.id)
      if (imageError) throw new Error(`No se guardó el estado de imagen ${row.id}: ${imageError.message}`)
      if (result) images.downloaded++
      else {
        images.failed++
        images.failedRows.push({ id: String(row.id), name: (row.name as string | null) ?? null, drive_url: String(row.drive_url) })
      }
    }))
    log({ imagesProcessed: Math.min(i + 4, pending.length), pendingTotal: pending.length, downloaded: images.downloaded, failed: images.failed, reused: images.reused })
  }
  report.images = images

  // Every confirmed row with a photo goes public now; no manual publish step.
  const { profileIds, skipped } = await publishPendingLegacySubmissions(db)
  report.published = { accounts: profileIds.length, skipped }
  log({ published: profileIds.length, publishSkipped: skipped })

  const { count, error: countError } = await db.from('legacy_submissions')
    .select('id', { count: 'exact', head: true }).is('archived_at', null)
  if (countError || count !== entries.length) throw new Error('El total activo no coincide con la planilla; revisar concurrencia.')
  report.verifiedActive = count
  log({ verifiedActive: count, downloaded: images.downloaded, failed: images.failed, reused: images.reused, deferred: images.deferred })
  return report
}
