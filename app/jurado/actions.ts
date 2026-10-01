'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ITEM_KEY_PATTERN, jurorFor } from '@/lib/jury'

export type ScoreState = { saved: boolean; error: string | null }

// One juror's score (1–10) and optional comment for one obra. The juror is
// whoever is signed in — never taken from the form — and must still be
// active; the obra key is checked against its pattern.
export async function saveScore(itemKey: string, _previous: ScoreState, formData: FormData): Promise<ScoreState> {
  const score = Number(formData.get('score'))
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 1000)
  if (!ITEM_KEY_PATTERN.test(itemKey) || !Number.isInteger(score) || score < 1 || score > 10) {
    return { saved: false, error: 'Elegí un puntaje del 1 al 10.' }
  }
  const { data: { user } } = await (await createClient()).auth.getUser()
  const db = createAdminClient()
  const juror = await jurorFor(db, user)
  if (!juror) return { saved: false, error: 'Tu cuenta no está habilitada como jurado.' }

  const { error } = await db.from('jury_scores').upsert(
    { juror_id: juror.id, item_key: itemKey, score, comment: comment || null, updated_at: new Date().toISOString() },
    { onConflict: 'juror_id,item_key' },
  )
  if (error) {
    console.error('saveScore failed', juror.id, itemKey, error)
    return { saved: false, error: 'No se pudo guardar. Probá de nuevo.' }
  }
  return { saved: true, error: null }
}
