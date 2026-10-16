'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ITEM_KEY_PATTERN, jurorFor, prepareJurorPhotoUpload, removeReplacedJurorPhoto } from '@/lib/jury'
import { parseJurorPhoto, parseJurorProfile } from '@/lib/juror-profile'
import { formatJuryDeadline, isVotingClosed } from '@/lib/jury-deadline'
import { site } from '@/lib/site'

export type ScoreState = { saved: boolean; error: string | null }

// One juror's score (1–10) and optional comment for one obra. The juror is
// whoever is signed in — never taken from the form — and must still be
// active; the obra key is checked against its pattern. Once the voting
// deadline (site.jury.deadlineISO) has passed, scores can't change.
export async function saveScore(itemKey: string, _previous: ScoreState, formData: FormData): Promise<ScoreState> {
  if (isVotingClosed(site.jury.deadlineISO)) {
    return { saved: false, error: `La votación cerró el ${formatJuryDeadline(site.jury.deadlineISO)}. Ya no se pueden cambiar los puntajes.` }
  }
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

// The juror's own profile (the form /jurado opens on until it's confirmed).
// Like saveScore, the juror is whoever is signed in. The first save marks the
// profile as confirmed and goes on to the obras.
export async function saveMyJurorProfile(formData: FormData) {
  const back = (message: string) => redirect(`/jurado?vista=ficha&error=${encodeURIComponent(message)}`)
  const parsed = parseJurorProfile(formData, { nameRequired: true })
  if ('error' in parsed) return back(parsed.error)
  const { data: { user } } = await (await createClient()).auth.getUser()
  const db = createAdminClient()
  const juror = await jurorFor(db, user)
  if (!juror) return back('Tu cuenta no está habilitada como jurado.')
  const photo = parseJurorPhoto(formData, juror.id)
  if ('error' in photo) return back(photo.error)
  const { error } = await db.from('jurors')
    .update({ ...parsed.profile, ...photo, profile_completed_at: juror.profile_completed_at ?? new Date().toISOString() })
    .eq('id', juror.id)
  if (error) {
    console.error('saveMyJurorProfile failed', juror.id, error)
    return back('No se pudo guardar. Probá de nuevo.')
  }
  await removeReplacedJurorPhoto(db, juror.photo_path, photo.photo_path)
  redirect('/jurado')
}

// The signed upload for the photo of the juror's own profile form.
export async function prepareMyJurorPhotoUpload(type: string) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  const db = createAdminClient()
  const juror = await jurorFor(db, user)
  if (!juror) return { error: 'Tu cuenta no está habilitada como jurado.' }
  return prepareJurorPhotoUpload(db, juror.id, String(type))
}
