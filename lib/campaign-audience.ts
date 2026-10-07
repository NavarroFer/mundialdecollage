// Who a campaign from /admin/campanas goes to. Every audience is a subset of
// the subscribed contacts, so an unsubscribe (the footer link, a bounce or a
// complaint — see 20260918070000_campaign_delivery_tracking.sql) always
// wins, whatever audience is picked.
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin'

export const CAMPAIGN_AUDIENCES = [
  { value: 'subscribed', label: 'Todos los suscriptos', description: 'Todos los contactos que no se dieron de baja.' },
  {
    value: 'no_artwork',
    label: 'Cuentas sin obra',
    // Mostly people who signed in to like or comment in the Galería 3D —
    // liking subscribes them (like_gallery_artwork) — and never finished
    // /onboarding.
    description: 'Entraron con Google pero no mandaron su obra (suscriptos, sin admins).',
  },
  {
    value: 'not_participating',
    label: 'No participan todavía',
    // Everyone on the list minus whoever already sent an obra (on the site or
    // through the form/sheet): «Avisame» sign-ups, likers, old contacts.
    // The countdown to the deadline goes here (lib/countdown-campaigns.ts).
    description: 'Suscriptos que todavía no mandaron una obra, por el sitio ni por el formulario (sin admins).',
  },
  { value: 'multiple_artworks', label: 'Varias obras por elegir', description: 'Artistas con varias obras cargadas y participación publicada que todavía no eligieron cuál participa gratis.' },
  {
    value: 'profile_review',
    label: 'Datos por confirmar',
    description: 'Artistas con obra que todavía deben confirmar o completar nombre, país o título.',
  },
] as const

export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number]['value']

export function parseAudience(value: unknown): CampaignAudience {
  return CAMPAIGN_AUDIENCES.some((audience) => audience.value === value) ? (value as CampaignAudience) : 'subscribed'
}

export function audienceLabel(value: string | null | undefined): string {
  return CAMPAIGN_AUDIENCES.find((audience) => audience.value === value)?.label ?? CAMPAIGN_AUDIENCES[0].label
}

const normalize = (email: string) => email.trim().toLowerCase()

// The subscribed contacts whose address is one of `accountEmails` (logins
// with no obra, from accounts_without_artwork_emails()), never an admin's —
// they log in to moderate, not to take part.
export function contactsWithoutArtwork<T extends { email: string }>(
  subscribed: T[],
  accountEmails: Iterable<string>,
  adminEmails: readonly string[] = ADMIN_EMAILS,
): T[] {
  const admins = new Set(adminEmails.map(normalize))
  const accounts = new Set([...accountEmails].map(normalize))
  return subscribed.filter((contact) => {
    const email = normalize(contact.email)
    return accounts.has(email) && !admins.has(email)
  })
}

// The subscribed contacts whose address isn't among `participantEmails`
// (participant_emails()), never an admin's.
export function contactsNotParticipating<T extends { email: string }>(
  subscribed: T[],
  participantEmails: Iterable<string>,
  adminEmails: readonly string[] = ADMIN_EMAILS,
): T[] {
  const excluded = new Set([...participantEmails, ...adminEmails].map(normalize))
  return subscribed.filter((contact) => !excluded.has(normalize(contact.email)))
}

// The same list for the composer's count (app/admin/campanas/nueva) and for
// the send itself (sendCampaign), so what the admin is shown is what goes out.
// `error` is set when the audience couldn't be worked out — never fall back
// to everyone in that case.
export async function audienceContacts(
  supabase: SupabaseClient,
  audience: CampaignAudience,
): Promise<{ contacts: Array<{ id: string; email: string; name: string | null; review?: ProfileReviewData; artworkTitles?: Array<string | null> }>; error: string | null }> {
  const { data: subscribed, error } = await supabase.from('contacts').select('id, email, name').eq('subscribed', true)
  if (error) return { contacts: [], error: error.message }
  if (audience === 'subscribed') return { contacts: subscribed ?? [], error: null }

  if (audience === 'multiple_artworks') {
    const { data, error: multipleError } = await supabase.rpc('multiple_artwork_contacts')
    if (multipleError) return { contacts: [], error: multipleError.message }
    const titlesByContact = new Map(
      ((data ?? []) as { contact_id: string; artwork_titles: Array<string | null> }[])
        .map((row) => [row.contact_id, row.artwork_titles]),
    )
    const admins = new Set(ADMIN_EMAILS.map(normalize))
    return {
      contacts: (subscribed ?? []).flatMap((contact) => {
        const artworkTitles = titlesByContact.get(contact.id)
        return artworkTitles && !admins.has(normalize(contact.email)) ? [{ ...contact, artworkTitles }] : []
      }),
      error: null,
    }
  }

  if (audience === 'profile_review') {
    const { data, error: reviewError } = await supabase.rpc('profile_review_contacts')
    if (reviewError) return { contacts: [], error: reviewError.message }
    const reviewByContact = new Map(
      ((data ?? []) as ProfileReviewRow[]).map((row) => [row.contact_id, {
        artistName: row.artist_name,
        countryCode: row.country_code,
        artworkTitle: row.artwork_title,
        missingFields: row.missing_fields ?? [],
      }]),
    )
    return {
      contacts: (subscribed ?? []).flatMap((contact) => {
        const review = reviewByContact.get(contact.id)
        return review ? [{ ...contact, review }] : []
      }),
      error: null,
    }
  }

  if (audience === 'not_participating') {
    const { data: participants, error: participantsError } = await supabase.rpc('participant_emails')
    if (participantsError) return { contacts: [], error: participantsError.message }
    const emails = ((participants ?? []) as { email: string | null }[]).flatMap((row) => (row.email ? [row.email] : []))
    return { contacts: contactsNotParticipating(subscribed ?? [], emails), error: null }
  }

  const { data: accounts, error: accountsError } = await supabase.rpc('accounts_without_artwork_emails')
  if (accountsError) return { contacts: [], error: accountsError.message }
  const emails = ((accounts ?? []) as { email: string | null }[]).flatMap((row) => (row.email ? [row.email] : []))
  return { contacts: contactsWithoutArtwork(subscribed ?? [], emails), error: null }
}

export type ProfileReviewData = {
  artistName: string | null
  countryCode: string | null
  artworkTitle: string | null
  missingFields: string[]
}

type ProfileReviewRow = {
  contact_id: string
  artist_name: string | null
  country_code: string | null
  artwork_title: string | null
  missing_fields: string[] | null
}
