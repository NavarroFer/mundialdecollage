'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { grantCourtesyGallery } from '@/lib/club-courtesy'
import { refreshClubGallery } from '@/lib/public-data-cache'

// Courtesy galleries for the Club's founders. Both actions run with the
// admin's own session: the database functions check is_admin() themselves,
// so this check only spares a round trip. redirect() throws, so it stays out
// of any try.

const PAGE = '/admin/club'

async function adminSession() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) throw new Error('Unauthorized')
  return db
}

export async function grantCourtesy(formData: FormData) {
  const db = await adminSession()
  const coins = String(formData.get('coins') ?? '').trim()
  const result = await grantCourtesyGallery(db, {
    email: String(formData.get('email') ?? ''),
    title: String(formData.get('title') ?? ''),
    coins: coins === '' ? 0 : Number(coins),
    reference: String(formData.get('reference') ?? ''),
  })
  if (!result.ok) redirect(`${PAGE}?error=${result.error}`)
  refreshClubGallery(result.slug)
  revalidatePath(PAGE)
  redirect(`${PAGE}?listo=${result.outcome}`)
}

export async function endCourtesy(formData: FormData) {
  const db = await adminSession()
  const { data: slug, error } = await db.rpc('end_club_courtesy', { p_gallery_id: String(formData.get('id') ?? '') })
  if (error) redirect(`${PAGE}?error=unavailable`)
  if (typeof slug === 'string') refreshClubGallery(slug)
  revalidatePath(PAGE)
  redirect(`${PAGE}?listo=ended`)
}

// Shows or hides a gallery among the examples of /club.
export async function setSample(formData: FormData) {
  const db = await adminSession()
  const { data: slug, error } = await db.rpc('set_club_gallery_sample', {
    p_gallery_id: String(formData.get('id') ?? ''),
    p_sample: formData.get('sample') === '1',
  })
  if (error) redirect(`${PAGE}?error=unavailable`)
  if (typeof slug === 'string') refreshClubGallery(slug)
  revalidatePath(PAGE)
  redirect(PAGE)
}
