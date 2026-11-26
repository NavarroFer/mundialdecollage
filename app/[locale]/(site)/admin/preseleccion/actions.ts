'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/jury'
import { loadPreselection, SLOT_KEY_PATTERN, splitObraKeys, stageView } from '@/lib/preselection'
import { FINAL_STAGE, repeatedArtists, STAGES, type Stage } from '@/lib/preselection-shared'

// A Server Action is reachable on its own, so each one checks for an admin
// session first. Picks are saved one click at a time and the mosaic keeps
// its own state, so only the actions that change which obras are on screen
// refresh the page.
async function adminDb() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!isAdminUser(user)) throw new Error('Not authorized')
  return { db: createAdminClient(), by: user!.email ?? null }
}

const validStage = (stage: number): stage is Stage => (STAGES as readonly number[]).includes(stage)
const validKeys = (keys: string[]) => Array.isArray(keys) && keys.length > 0 && keys.length <= 500 && keys.every((key) => typeof key === 'string' && SLOT_KEY_PATTERN.test(key))

type Result = { error?: string }

/** Marks or unmarks obras in a stage (one click, or «Marcar todas»). */
export async function setPicks(stage: number, slotKeys: string[], picked: boolean): Promise<Result> {
  if (!validStage(stage) || !validKeys(slotKeys)) return { error: 'Datos inválidos.' }
  const { db, by } = await adminDb()
  const now = new Date().toISOString()
  const { error } = await db.from('preselection_marks')
    .upsert(slotKeys.map((slot_key) => ({ stage, slot_key, picked: Boolean(picked), updated_at: now, updated_by: by })), { onConflict: 'stage,slot_key' })
  if (error) {
    console.error('preselection: pick not saved', error)
    return { error: 'No se guardó la marca. Probá de nuevo.' }
  }
  return {}
}

/**
 * «Siguiente tanda»: the obras on screen count as seen, in a new batch. Only
 * `batch` is written, so a pick saved a moment earlier is kept.
 */
export async function closeBatch(stage: number, slotKeys: string[]): Promise<Result> {
  if (!validStage(stage) || stage === FINAL_STAGE || !validKeys(slotKeys)) return { error: 'Datos inválidos.' }
  const { db, by } = await adminDb()
  const { data: last, error: readError } = await db.from('preselection_marks')
    .select('batch').eq('stage', stage).not('batch', 'is', null)
    .order('batch', { ascending: false }).limit(1).maybeSingle()
  if (readError) return { error: 'No se pudo cerrar la tanda. Probá de nuevo.' }
  const batch = (last?.batch ?? 0) + 1
  const now = new Date().toISOString()
  const { error } = await db.from('preselection_marks')
    .upsert(slotKeys.map((slot_key) => ({ stage, slot_key, batch, updated_at: now, updated_by: by })), { onConflict: 'stage,slot_key' })
  if (error) {
    console.error('preselection: batch not closed', error)
    return { error: 'No se pudo cerrar la tanda. Probá de nuevo.' }
  }
  revalidatePath('/admin/preseleccion')
  return {}
}

/** «Tanda anterior»: the last batch goes back on screen, with its picks. */
export async function reopenBatch(stage: number): Promise<Result> {
  if (!validStage(stage) || stage === FINAL_STAGE) return { error: 'Datos inválidos.' }
  const { db } = await adminDb()
  const { data: last } = await db.from('preselection_marks')
    .select('batch').eq('stage', stage).not('batch', 'is', null)
    .order('batch', { ascending: false }).limit(1).maybeSingle()
  if (!last?.batch) return { error: 'No hay una tanda anterior.' }
  const { error } = await db.from('preselection_marks').update({ batch: null }).eq('stage', stage).eq('batch', last.batch)
  if (error) return { error: 'No se pudo volver a la tanda anterior.' }
  revalidatePath('/admin/preseleccion')
  return {}
}

/** For an artist with several obras who never chose: which one fills the slot. */
export async function chooseObra(slotKey: string, obraKey: string): Promise<Result> {
  if (!validKeys([slotKey, obraKey])) return { error: 'Datos inválidos.' }
  const { db, by } = await adminDb()
  const { error } = slotKey === obraKey
    ? await db.from('preselection_choices').delete().eq('slot_key', slotKey)
    : await db.from('preselection_choices').upsert({ slot_key: slotKey, item_key: obraKey, updated_at: new Date().toISOString(), updated_by: by }, { onConflict: 'slot_key' })
  if (error) {
    console.error('preselection: choice not saved', error)
    return { error: 'No se pudo cambiar la obra. Probá de nuevo.' }
  }
  revalidatePath('/admin/preseleccion')
  return {}
}

/**
 * «Enviar al jurado»: what is marked at the final table becomes the jury's
 * pool (review_status «Preseleccionada»), and every other obra goes back to
 * «Sin revisar», in one transaction (public.preselection_send).
 */
export async function sendToJury(): Promise<Result & { sent?: number }> {
  const { db } = await adminDb()
  const { slots, marks } = await loadPreselection(db)
  const final = stageView(slots, marks, FINAL_STAGE)
  const chosen = final.pool.filter((slot) => final.picked.has(slot.key))
  if (chosen.length === 0) return { error: 'No hay obras marcadas en la mesa final.' }
  const repeated = repeatedArtists(chosen, final.picked)
  if (repeated.length > 0) {
    return { error: `Hay artistas con más de una obra: ${repeated.map((group) => group[0].artist).join(', ')}. Dejá una sola de cada uno.` }
  }
  const { artworkIds, legacyIds } = splitObraKeys(chosen.map((slot) => slot.obra.key))
  const { data, error } = await db.rpc('preselection_send', { artwork_ids: artworkIds, legacy_ids: legacyIds })
  if (error) {
    console.error('preselection: send failed', error)
    return { error: 'No se pudo enviar al jurado. No se cambió nada.' }
  }
  revalidatePath('/admin/preseleccion')
  revalidatePath('/admin/jurado')
  revalidatePath('/admin/obras')
  revalidatePath('/jurado')
  return { sent: typeof data === 'number' ? data : chosen.length }
}
