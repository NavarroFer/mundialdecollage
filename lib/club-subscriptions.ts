import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify } from '@/lib/slug'
import { subscriptionExternalReference } from '@/lib/payments/references'
import { clubMembershipPlanById } from '@/lib/store'
import { mpPlanId } from '@/lib/subscription-receipts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Until the artist picks another one in the editor. */
export const DEFAULT_HOST_AVATAR = 'Female_Adult_01'

/** The gallery's address: the artist's name plus the start of their account id, so two artists never collide. */
export function clubGallerySlug(name: string, userId: string): string {
  return `${slugify(name) || 'artista'}-${userId.replace(/-/g, '').slice(0, 8).toLowerCase()}`
}

export type ClubSubscriptionInput = {
  userId: string
  email: string
  name: string
  planId: string
  /** Where Mercado Pago sends the artist back after authorizing the charge. */
  backUrl: string
}

export type ClubSubscriptionDeps = {
  admin: SupabaseClient
  upsertCustomer: (email: string, fullName: string) => Promise<string>
  createPreapproval: (request: {
    reference: string
    reason: string
    payerEmail: string
    amount: number
    backUrl: string
  }) => Promise<{ id?: string; checkoutUrl?: string }>
}

export type ClubSubscriptionResult =
  | { ok: true; checkoutUrl: string; subscriptionId: string }
  | { ok: false; error: 'invalid' | 'already_member' | 'unavailable' }

/**
 * Starts the monthly Club membership with Mercado Pago. The local rows come
 * first (service role): a pending subscription and the artist's gallery in
 * draft, linked to it. The first approved charge is what activates the
 * gallery and credits the month's coins (record_subscription_payment), so
 * nobody has a public gallery without paying. An artist who comes back after
 * a lapse keeps the gallery they had: it is linked to the new subscription.
 */
export async function startClubMpSubscription(input: ClubSubscriptionInput, deps: ClubSubscriptionDeps): Promise<ClubSubscriptionResult> {
  const plan = clubMembershipPlanById(input.planId)
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim().slice(0, 120)
  // The annual plan needs the monthly coin credit job, so it is not sold yet.
  if (!plan || plan.billing !== 'monthly' || !UUID.test(input.userId) || !EMAIL.test(email) || email.length > 254 || !name) {
    return { ok: false, error: 'invalid' }
  }

  const { data: existing, error: existingError } = await deps.admin
    .from('club_galleries')
    .select('id, status')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (existingError) return { ok: false, error: 'unavailable' }
  if (existing?.status === 'active') return { ok: false, error: 'already_member' }

  let subscriptionId: string
  try {
    const customerId = await deps.upsertCustomer(email, name)
    const { data, error } = await deps.admin
      .from('subscriptions')
      .insert({ customer_id: customerId, provider: 'mercadopago', provider_plan_id: mpPlanId(plan.id), shipping_address: null })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'no row')
    subscriptionId = data.id
  } catch {
    return { ok: false, error: 'unavailable' }
  }

  const linked = existing
    ? await deps.admin.from('club_galleries').update({ subscription_id: subscriptionId }).eq('id', existing.id)
    : await deps.admin.from('club_galleries').insert({
        user_id: input.userId,
        subscription_id: subscriptionId,
        slug: clubGallerySlug(name, input.userId),
        title: name,
        host_avatar_id: DEFAULT_HOST_AVATAR,
      })
  if (linked.error) return { ok: false, error: 'unavailable' }

  try {
    const preapproval = await deps.createPreapproval({
      reference: subscriptionExternalReference(subscriptionId),
      reason: 'Club del Mundial de Collage — membresía mensual',
      payerEmail: email,
      amount: plan.priceArs,
      backUrl: input.backUrl,
    })
    if (!preapproval.id || !preapproval.checkoutUrl) throw new Error('Mercado Pago returned no checkout')
    const { error } = await deps.admin.from('subscriptions').update({ provider_subscription_id: preapproval.id }).eq('id', subscriptionId)
    if (error) throw new Error(error.message)
    return { ok: true, checkoutUrl: preapproval.checkoutUrl, subscriptionId }
  } catch (err) {
    await deps.admin.from('subscriptions').update({ checkout_error: { message: err instanceof Error ? err.message : 'checkout failed' } }).eq('id', subscriptionId)
    return { ok: false, error: 'unavailable' }
  }
}
