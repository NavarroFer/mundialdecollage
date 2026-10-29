import { describe, expect, it, vi } from 'vitest'
import { clubGallerySlug, startClubMpSubscription, type ClubSubscriptionDeps } from './club-subscriptions'

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
  const createPreapproval = vi.fn(async () => {
    if (failPreapproval) throw new Error('boom')
    return { id: 'pre-1', checkoutUrl: 'https://mp.example/checkout' }
  })
  const deps = { admin, upsertCustomer: vi.fn(async () => 'cust-1'), createPreapproval } as unknown as ClubSubscriptionDeps
  return { calls, deps, createPreapproval }
}

const input = { userId: USER, email: ' Ana@Example.com ', name: 'Ana Pérez', planId: 'club-monthly', backUrl: 'https://site.example/mi-galeria' }

describe('clubGallerySlug', () => {
  it('uses the name and the start of the account id', () => {
    expect(clubGallerySlug('Ana Pérez', USER)).toBe('ana-perez-7d2c0a4e')
    expect(clubGallerySlug('???', USER)).toBe('artista-7d2c0a4e')
  })
})

describe('startClubMpSubscription', () => {
  it('creates a pending subscription and a draft gallery, and charges the monthly price', async () => {
    const { calls, deps, createPreapproval } = setup()
    const result = await startClubMpSubscription(input, deps)

    expect(result).toEqual({ ok: true, checkoutUrl: 'https://mp.example/checkout', subscriptionId: 'sub-1' })
    expect(calls.subscriptionInsert).toEqual([{ customer_id: 'cust-1', provider: 'mercadopago', provider_plan_id: 'mp:club-monthly', shipping_address: null }])
    expect(calls.galleryInsert).toEqual([
      { user_id: USER, subscription_id: 'sub-1', slug: 'ana-perez-7d2c0a4e', title: 'Ana Pérez', host_avatar_id: 'Female_Adult_01' },
    ])
    expect(createPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amount: 29000, payerEmail: 'ana@example.com', reference: 'suscripcion:sub-1' }))
    expect(calls.subscriptionUpdate).toEqual([{ provider_subscription_id: 'pre-1' }])
  })

  it('links the new subscription to the gallery an artist already had', async () => {
    const { calls, deps } = setup({ id: 'gallery-1', status: 'paused' })
    expect((await startClubMpSubscription(input, deps)).ok).toBe(true)
    expect(calls.galleryInsert).toEqual([])
    expect(calls.galleryUpdate).toEqual([{ subscription_id: 'sub-1' }])
  })

  it('does not charge an active member twice', async () => {
    const { calls, deps, createPreapproval } = setup({ id: 'gallery-1', status: 'active' })
    expect(await startClubMpSubscription(input, deps)).toEqual({ ok: false, error: 'already_member' })
    expect(calls.subscriptionInsert).toEqual([])
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('refuses the annual plan, an unknown plan, a bad email or user id', async () => {
    const { deps, createPreapproval } = setup()
    for (const bad of [{ planId: 'club-annual' }, { planId: 'nope' }, { email: 'not-an-email' }, { userId: 'x' }, { name: '  ' }]) {
      expect(await startClubMpSubscription({ ...input, ...bad }, deps)).toEqual({ ok: false, error: 'invalid' })
    }
    expect(createPreapproval).not.toHaveBeenCalled()
  })

  it('records the failure and reports it when Mercado Pago refuses', async () => {
    const { calls, deps } = setup(null, true)
    expect(await startClubMpSubscription(input, deps)).toEqual({ ok: false, error: 'unavailable' })
    expect(calls.subscriptionUpdate).toEqual([{ checkout_error: { message: 'boom' } }])
  })
})
