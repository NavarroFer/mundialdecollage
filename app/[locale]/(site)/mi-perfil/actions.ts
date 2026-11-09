'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { cleanInstagramInput, cleanWebsiteInput } from '@/lib/onboarding-input'
import { normalizeInstagram, normalizeWebsite } from '@/lib/profile-links'
import { refreshArtworkData, refreshPublicData } from '@/lib/public-data-cache'

// «Mis datos»: the artist corrects what they typed (or what we imported from
// the Registro) — name, country, links, and each obra's title and technique.
// The email is the account's and never changes here. An answer is a code in
// the address (?error=…), shown in the reader's language, like the Club
// editor's. redirect() throws, so it stays out of any try.

const PAGE = '/mi-perfil'
const back = (code: string): never => redirect(`${PAGE}?error=${code}`)

const NAME_MAX = 120
const TITLE_MAX = 200

export async function saveProfile(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')
  const user = await getCurrentUser()
  if (!user) redirect('/onboarding')

  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  if (!name || !getAllCountryCodes().includes(countryCode)) back('missing_fields')

  const instagramInput = cleanInstagramInput(String(formData.get('instagram') ?? ''))
  const instagram = instagramInput ? normalizeInstagram(instagramInput) : null
  if (instagramInput === null || (instagramInput && !instagram)) back('invalid_instagram')
  const websiteInput = cleanWebsiteInput(String(formData.get('website') ?? ''))
  const website = websiteInput ? normalizeWebsite(websiteInput) : null
  if (websiteInput === null || (websiteInput && !website)) back('invalid_website')

  // One entry per obra, in the order the page lists them.
  const ids = formData.getAll('artwork_id').map((value) => String(value))
  const titles = formData.getAll('artwork_title').map((value) => String(value).trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX))
  const techniques = formData.getAll('technique').map((value) => String(value).trim())
  if (ids.length !== titles.length || ids.length !== techniques.length) back('save_failed')
  if (titles.some((title) => !title)) back('missing_title')
  if (techniques.some((technique) => technique && !(TECHNIQUES as readonly string[]).includes(technique))) back('save_failed')

  const supabase = await createClient()
  const [{ data: profile, error: profileReadError }, { data: artworks, error: artworksError }] = await Promise.all([
    supabase.from('profiles').select('name, country_code').eq('id', user.id).maybeSingle(),
    supabase.from('artworks').select('id, slug, title, technique').eq('profile_id', user.id),
  ])
  if (profileReadError || artworksError) back('save_failed')
  // Nothing to edit until the artist has signed up (/onboarding).
  if (!profile) redirect('/onboarding')

  // The ids arrive as plain form data: each must be one of this artist's own.
  const own = new Map((artworks ?? []).map((artwork) => [artwork.id, artwork]))
  if (new Set(ids).size !== ids.length || ids.some((id) => !own.has(id))) back('save_failed')

  // Their own session: row security confines it to their own row, and the
  // trigger on profiles keeps is_public out of their reach.
  const { data: saved, error: profileError } = await supabase
    .from('profiles')
    .update({ name, country_code: countryCode, instagram, website })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()
  if (profileError || !saved) {
    console.error('saveProfile: profile update failed', user.id, profileError)
    back('save_failed')
  }

  // artworks has no UPDATE grant for artists (what is selected or published
  // is curated by admins), so title and technique go through the service
  // role, only for the obras just proved to be theirs and only those that
  // changed. A title written here is never replaced by the Registro sync.
  const changed = ids.flatMap((id, index) => {
    const current = own.get(id)!
    const technique = techniques[index] || null
    return titles[index] === current.title && technique === (current.technique ?? null) ? [] : [{ current, title: titles[index], technique }]
  })
  const admin = createAdminClient()
  for (const { current, title, technique } of changed) {
    const { error } = await admin.from('artworks').update({ title, technique }).eq('id', current.id).eq('profile_id', user.id)
    if (error) {
      console.error('saveProfile: artwork update failed', user.id, current.id, error)
      back('save_failed')
    }
  }

  // The name in the mailing list is what newsletters and campaigns greet
  // with; it's the one that arrived misspelled. Best-effort: the profile is
  // what matters, and a person who never subscribed has no row to fix.
  if (user.email && name !== profile.name) {
    const { error } = await admin.from('contacts').update({ name }).eq('email', user.email.trim().toLowerCase())
    if (error) console.error('saveProfile: contact name update failed', user.id, error)
  }

  // A new country moves the artist on the map and the counts; a name or
  // title only touches their own pages and the listings.
  if (countryCode !== profile.country_code) refreshPublicData()
  else refreshArtworkData((artworks ?? []).map((artwork) => ({ slug: artwork.slug, profile_id: user.id })))
  revalidatePath('/')
  for (const artwork of artworks ?? []) if (artwork.slug) revalidatePath(`/obras/${artwork.slug}`)
  redirect(`${PAGE}?guardado=1`)
}
