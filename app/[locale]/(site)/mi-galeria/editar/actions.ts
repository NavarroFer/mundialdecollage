'use server'

import { redirect } from 'next/navigation'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { refreshClubGallery } from '@/lib/public-data-cache'
import { canUseClub } from '@/lib/club-launch'
import { fitsRoom, parseGallerySettings, parseHangings, roomCapacity } from '@/lib/club-editor'
import { PURCHASABLE_GALLERY_ITEMS, type ClubRoomTemplate } from '@/lib/gallery-catalog'

// The Club editor's writes. Each one runs with the member's own session, so
// the database's row security and its triggers decide what is allowed; the
// checks here (lib/club-editor.ts) only answer with something readable first.
// An answer is a code in the address (?error=…), shown in the reader's
// language. redirect() throws, so it stays out of any try.

const EDITOR = '/mi-galeria/editar'
const back = (code: string): never => redirect(`${EDITOR}?error=${code}`)

async function member() {
  if (!isSupabaseConfigured) redirect('/')
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  if (!canUseClub(user.email)) redirect('/')
  const supabase = await createClient()
  const { data: gallery } = await supabase
    .from('club_galleries')
    .select('id, slug, template_id, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!gallery || gallery.status !== 'active') redirect('/mi-galeria')
  return { user, supabase, gallery }
}

export async function saveGallerySettings(formData: FormData) {
  const { supabase, gallery } = await member()
  const { data: inventory, error: inventoryError } = await supabase.from('user_gallery_inventory').select('item_id')
  if (inventoryError) back('unavailable')

  const parsed = parseGallerySettings(formData, new Set((inventory ?? []).map((row) => row.item_id)))
  if (!parsed.ok) back(parsed.error)
  if (!parsed.ok) return

  if (parsed.settings.template_id !== gallery.template_id) {
    const { data: hung, error } = await supabase.from('club_gallery_hangings').select('slot').eq('gallery_id', gallery.id)
    if (error) back('unavailable')
    if (!fitsRoom((hung ?? []).map((row) => row.slot), roomCapacity(parsed.settings.template_id))) back('room')
  }

  const { error } = await supabase.from('club_galleries').update(parsed.settings).eq('id', gallery.id)
  if (error) {
    console.error('saveGallerySettings: update failed', error.code, error.message)
    back(/not unlocked/i.test(error.message) ? 'locked' : 'unavailable')
  }
  refreshClubGallery(gallery.slug)
  redirect(`${EDITOR}?guardado=1`)
}

export async function saveHangings(formData: FormData) {
  const { user, supabase, gallery } = await member()
  const { data: artworks, error: artworksError } = await supabase
    .from('artworks')
    .select('id')
    .eq('profile_id', user.id)
    .is('archived_at', null)
    .is('duplicate_of', null)
  if (artworksError) back('unavailable')

  const parsed = parseHangings(formData, roomCapacity(gallery.template_id as ClubRoomTemplate), new Set((artworks ?? []).map((row) => row.id)))
  if (!parsed.ok) back(parsed.error)
  if (!parsed.ok) return

  const { error } = await supabase.rpc('replace_club_gallery_hangings', { p_rows: parsed.rows })
  if (error) {
    console.error('saveHangings: replace failed', error.code, error.message)
    back('unavailable')
  }
  refreshClubGallery(gallery.slug)
  redirect(`${EDITOR}?guardado=1`)
}

export async function unlockItem(formData: FormData) {
  const { supabase } = await member()
  const itemId = String(formData.get('item') ?? '')
  if (!PURCHASABLE_GALLERY_ITEMS.some((item) => item.id === itemId)) back('invalid')

  const { error } = await supabase.rpc('spend_coins_on_item', { p_item_id: itemId })
  if (error) {
    if (!/insufficient/i.test(error.message)) console.error('unlockItem: spend failed', error.code, error.message)
    back(/insufficient/i.test(error.message) ? 'coins' : 'unavailable')
  }
  redirect(`${EDITOR}?desbloqueado=1`)
}
