'use server'

import { redirect } from 'next/navigation'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { refreshClubGallery } from '@/lib/public-data-cache'
import { canUseOwnClubGallery } from '@/lib/club-launch'
import { createAdminClient } from '@/lib/supabase/admin'
import { CLUB_MAX_OBRAS, fitsRoom, parseClubArtwork, parseGallerySettings, parseHangings, roomCapacity } from '@/lib/club-editor'
import { uniqueArtworkSlug } from '@/lib/artwork-slug'
import { parseHome } from '@/lib/club-map'
import { getAllCountryCodes } from '@/lib/participants'
import { slugify } from '@/lib/slug'
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
  const supabase = await createClient()
  const { data: gallery } = await supabase
    .from('club_galleries')
    .select('id, slug, template_id, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!canUseOwnClubGallery(user.email, gallery?.status)) redirect('/')
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

// An obra only for the Club (artworks.is_club_only): it never enters the
// contest (the database refuses it as entry or main obra). The photo went
// straight from the browser to Storage, like the onboarding ones, because a
// Server Action's body is capped well under a phone photo.
export async function addClubArtwork(formData: FormData) {
  const { user, supabase } = await member()
  const [{ data: profile, error: profileError }, { count, error: countError }] = await Promise.all([
    supabase.from('profiles').select('name, country_code').eq('id', user.id).maybeSingle(),
    supabase.from('artworks').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('is_club_only', true).is('archived_at', null),
  ])
  if (profileError || countError) back('unavailable')
  if ((count ?? 0) >= CLUB_MAX_OBRAS) back('limit')

  const needsProfile = !profile?.name?.trim() || !profile.country_code
  const parsed = parseClubArtwork(formData, user.id, needsProfile, new Set(getAllCountryCodes()))
  if (!parsed.ok) back(parsed.error)
  if (!parsed.ok) return
  const { artwork } = parsed

  const [folder, filename] = artwork.imagePath.split('/')
  const { data: files } = await supabase.storage.from('artworks').list(folder, { search: filename })
  if (!files?.some((file) => file.name === filename)) back('upload')

  if (artwork.profile) {
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...artwork.profile })
    if (error) {
      console.error('addClubArtwork: profile failed', error.code, error.message)
      back('unavailable')
    }
  }
  const name = artwork.profile?.name ?? profile?.name ?? ''
  const slug = await uniqueArtworkSlug(supabase, slugify(`${name}-${artwork.title ?? 'obra'}`) || user.id.slice(0, 8))
  const { data: { publicUrl } } = supabase.storage.from('artworks').getPublicUrl(artwork.imagePath)
  const { error } = await supabase.from('artworks').insert({
    profile_id: user.id,
    slug,
    title: artwork.title,
    technique: artwork.technique,
    image_url: publicUrl,
    is_club_only: true,
  })
  if (error) {
    console.error('addClubArtwork: insert failed', error.code, error.message)
    back('unavailable')
  }
  redirect(`${EDITOR}?subida=1#obras`)
}

// Removes a Club obra for good, with its likes and stamps. Artists have no
// DELETE on artworks, so the service role does it once the row is proven to
// be theirs and Club only.
export async function removeClubArtwork(formData: FormData) {
  const { user, gallery } = await member()
  const id = String(formData.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) back('invalid')
  const { data, error } = await createAdminClient()
    .from('artworks')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.id)
    .eq('is_club_only', true)
    .select('id')
  if (error) {
    console.error('removeClubArtwork: delete failed', error.code, error.message)
    back('unavailable')
  }
  if (!data?.length) back('invalid')
  refreshClubGallery(gallery.slug)
  redirect(`${EDITOR}?quitada=1#obras`)
}

// Where the member's house sits on the Club map, or no house (an empty
// form). Rounded here as the database will keep it (lib/club-map.ts).
export async function saveGalleryHome(formData: FormData) {
  const { supabase, gallery } = await member()
  const home = parseHome(formData)
  if (home === undefined) back('invalid')
  const { error } = await supabase
    .from('club_galleries')
    .update({ home_lat: home?.lat ?? null, home_lng: home?.lng ?? null })
    .eq('id', gallery.id)
  if (error) {
    console.error('saveGalleryHome: update failed', error.code, error.message)
    back('unavailable')
  }
  refreshClubGallery(gallery.slug)
  redirect(`${EDITOR}?casa=${home ? 1 : 0}#casa`)
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
