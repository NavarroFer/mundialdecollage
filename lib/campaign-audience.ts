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

// The same list for the composer's count (app/admin/campanas/nueva) and for
// the send itself (sendCampaign), so what the admin is shown is what goes out.
// `error` is set when the audience couldn't be worked out — never fall back
// to everyone in that case.
export async function audienceContacts(
  supabase: SupabaseClient,
  audience: CampaignAudience,
): Promise<{ contacts: { id: string; email: string; name: string | null }[]; error: string | null }> {
  const { data: subscribed, error } = await supabase.from('contacts').select('id, email, name').eq('subscribed', true)
  if (error) return { contacts: [], error: error.message }
  if (audience === 'subscribed') return { contacts: subscribed ?? [], error: null }

  const { data: accounts, error: accountsError } = await supabase.rpc('accounts_without_artwork_emails')
  if (accountsError) return { contacts: [], error: accountsError.message }
  const emails = ((accounts ?? []) as { email: string | null }[]).flatMap((row) => (row.email ? [row.email] : []))
  return { contacts: contactsWithoutArtwork(subscribed ?? [], emails), error: null }
}
