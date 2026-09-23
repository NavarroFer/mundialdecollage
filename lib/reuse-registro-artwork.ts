import type { SupabaseClient } from '@supabase/supabase-js'
import { registroImageFingerprint } from '@/lib/registro-image-fingerprint'

// Run before setting legacy_submissions.image_url: that update fires the
// account-linking trigger, which would otherwise insert a second artwork.
export async function reuseRegistroArtwork(
  db: SupabaseClient,
  row: { id: string; claimed_by: string | null },
  fingerprint: string,
): Promise<boolean> {
  if (!row.claimed_by) return false
  const { data: artworks, error } = await db.from('artworks')
    .select('id, profile_id, image_url, legacy_submission_id')
    .eq('profile_id', row.claimed_by)
  if (error) throw new Error(`No se pudieron revisar obras existentes: ${error.message}`)
  const oldIds = artworks.map((artwork) => artwork.legacy_submission_id).filter((id): id is string => !!id)
  const { data: sources, error: sourceError } = oldIds.length
    ? await db.from('legacy_submissions').select('id, archived_at').in('id', oldIds)
    : { data: [], error: null }
  if (sourceError) throw new Error(`No se pudieron revisar fuentes existentes: ${sourceError.message}`)
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const ownStoragePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artworks/`
  const matches = []
  for (const artwork of artworks) {
    if (!artwork.image_url) continue
    if (!artwork.image_url.startsWith(ownStoragePrefix)) {
      throw new Error(`La obra ${artwork.id} tiene una imagen externa que requiere revisión.`)
    }
    const response = await fetch(artwork.image_url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`No se pudo comparar la obra ${artwork.id} (${response.status}).`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > 20_000_000) throw new Error(`La obra ${artwork.id} es demasiado grande para comparar.`)
    if (await registroImageFingerprint(bytes) === fingerprint) matches.push(artwork)
  }
  if (matches.length > 1) throw new Error(`Varias obras coinciden con ${row.id}; requiere revisión.`)
  if (!matches.length) return false
  const match = matches[0]
  if (match.legacy_submission_id === row.id) return true
  if (match.legacy_submission_id && !sourceById.get(match.legacy_submission_id)?.archived_at) {
    throw new Error(`La imagen de ${row.id} ya corresponde a otra fila activa de Registro.`)
  }
  let update = db.from('artworks').update({ legacy_submission_id: row.id, archived_at: null })
    .eq('id', match.id).eq('profile_id', row.claimed_by)
  update = match.legacy_submission_id == null
    ? update.is('legacy_submission_id', null)
    : update.eq('legacy_submission_id', match.legacy_submission_id)
  const { data: attached, error: attachError } = await update.select('id')
  if (attachError || attached?.length !== 1) {
    throw new Error(`No se pudo reutilizar la obra ${match.id}: ${attachError?.message ?? 'cambio concurrente'}`)
  }
  return true
}
