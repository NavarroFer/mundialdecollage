import { describe, expect, it, vi } from 'vitest'
import { clubGallerySlug, startClubSubscription, type ClubSubscriptionDeps } from './club-subscriptions'

const USER = '7d2c0a4e-0000-4000-8000-000000000001'

function setup(existing: { id: string; status: string } | null = null, failPreapproval = false) {
  const calls = { subscriptionInsert: [] as unknown[], galleryInsert: [] as unknown[], galleryUpdate: [] as unknown[], subscriptionUpdate: [] as unknown[] }
  const admin = {
    from: (table: string) => {
      if (table === 'club_galleries') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
          insert: async (row: unknown) => { calls.galleryInsert.push(row); return { error: null } },
          update: (row: unknown) => ({ eq: async () => { calls.galleryUpdate.push(row); return { error: null } } }),
        }
      }
      return {
        insert: (row: unknown) => ({
          select: () => ({ single: async () => { calls.subscriptionInsert.push(row); return { data: { id: 'sub-1' }, error: null } } }),
        }),
        update: (row: unknown) => ({ eq: async () => { calls.subscriptionUpdate.push(row); return { error: null } } }),
      }
    },
  }
  const createSubscription = vi.fn(async () => {
    if (failPreapproval) throw new Error('boom')
    return { id: 'pre-1', checkoutUrl: 'https://mp.example/checkout' }
  })
  const deps = { admin, upsertCustomer: vi.fn(async () => 'cust-1'), createSubscription, paypalPlanId: 'P-CLUB-USD-29' } as unknown as ClubSubscriptionDeps
  return { calls, deps, createSubscription }
}

const input = { provider: 'mercadopago' as const, userId: USER, email: ' Ana@Example.com ', name: 'Ana Pérez', planId: 'club-monthly', backUrl: 'https://site.example/mi-galeria' }

describe('clubGallerySlug', () => {
  it('uses the name and the start of the account id', () => {
    expect(clubGallerySlug('Ana Pérez', USER)).toBe('ana-perez-7d2c0a4e')
    expect(clubGallerySlug('???', USER)).toBe('artista-7d2c0a4e')
  })
})

describe('startClubSubscription', () => {
  it('creates a pending subscription and a draft gallery, and charges the monthly price', async () => {
    const { calls, deps, createSubscription } = setup()
    const result = await startClubSubscription(input, deps)

    expect(result).toEqual({ ok: true, checkoutUrl: 'https://mp.example/checkout', subscriptionId: 'sub-1' })
    expect(calls.subscriptionInsert).toEqual([{ customer_id: 'cust-1', provider: 'mercadopago', provider_plan_id: 'mp:club-monthly', shipping_address: null }])
    expect(calls.galleryInsert).toEqual([
      { user_id: USER, subscription_id: 'sub-1', slug: 'ana-perez-7d2c0a4e', title: 'Ana Pérez', host_avatar_id: 'Female_Adult_01' },
    ])
    expect(createSubscription).toHaveBeenCalledWith(expect.objectContaining({ amount: 29000, currency: 'ARS', payerEmail: 'ana@example.com', reference: 'suscripcion:sub-1' }))
    expect(calls.subscriptionUpdate).toEqual([{ provider_subscription_id: 'pre-1' }])
  })

  it('subscribes with PayPal in dollars against the plan created in PayPal', async () => {
    const { calls, deps, createSubscription } = setup()
    const result = await startClubSubscription({ ...input, provider: 'paypal' }, deps)

    expect(result).toEqual({ ok: true, checkoutUrl: 'https://mp.example/checkout', subscriptionId: 'sub-1' })
    expect(calls.subscriptionInsert).toEqual([{ customer_id: 'cust-1', provider: 'paypal', provider_plan_id: 'P-CLUB-USD-29', shipping_address: null }])
    expect(createSubscription).toHaveBeenCalledWith(expect.objectContaining({ amount: 29, currency: 'USD', localId: 'sub-1' }))
  })

  it('creates nothing for PayPal while its plan is not set up', async () => {
    const { calls, deps, createSubscription } = setup()
    const result = await startClubSubscription({ ...input, provider: 'paypal' }, { ...deps, paypalPlanId: undefined })

    expect(result).toEqual({ ok: false, error: 'unavailable' })
    expect(calls.subscriptionInsert).toEqual([])
    expect(calls.galleryInsert).toEqual([])
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it('links the new subscription to the gallery an artist already had', async () => {
    const { calls, deps } = setup({ id: 'gallery-1', status: 'paused' })
    expect((await startClubSubscription(input, deps)).ok).toBe(true)
    expect(calls.galleryInsert).toEqual([])
    expect(calls.galleryUpdate).toEqual([{ subscription_id: 'sub-1' }])
  })

  it('does not charge an active member twice', async () => {
    const { calls, deps, createSubscription } = setup({ id: 'gallery-1', status: 'active' })
    expect(await startClubSubscription(input, deps)).toEqual({ ok: false, error: 'already_member' })
    expect(calls.subscriptionInsert).toEqual([])
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it('refuses the annual plan, an unknown plan, a bad email or user id', async () => {
    const { deps, createSubscription } = setup()
    for (const bad of [{ planId: 'club-annual' }, { planId: 'nope' }, { email: 'not-an-email' }, { userId: 'x' }, { name: '  ' }]) {
      expect(await startClubSubscription({ ...input, ...bad }, deps)).toEqual({ ok: false, error: 'invalid' })
    }
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it('records the failure and reports it when Mercado Pago refuses', async () => {
    const { calls, deps } = setup(null, true)
    expect(await startClubSubscription(input, deps)).toEqual({ ok: false, error: 'unavailable' })
    expect(calls.subscriptionUpdate).toEqual([{ checkout_error: { message: 'boom' } }])
  })
})
