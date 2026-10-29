import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentProvider } from './payments/provider'

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: db.insert,
      update: db.update,
    }),
  }),
}))

import { createCoinPackCheckout } from './club-payments'

const USER_ID = '7d2c0a4e-0000-4000-8000-000000000001'

function provider(id: PaymentProvider['id']): PaymentProvider {
  return {
    id,
    isConfigured: true,
    createCheckout: vi.fn(async () => ({ url: 'https://checkout.example/pay', id: 'checkout-1' })),
    fetchPayment: vi.fn(),
  }
}

beforeEach(() => {
  db.insert.mockReset().mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: 'purchase-1' }, error: null }) }),
  })
  db.update.mockReset().mockReturnValue({ eq: async () => ({ error: null }) })
})

describe('createCoinPackCheckout', () => {
  it('uses the ARS catalogue price and a coin-pack reference with Mercado Pago', async () => {
    const paymentProvider = provider('mercadopago')
    const result = await createCoinPackCheckout({
      userId: USER_ID,
      email: ' ARTISTA@example.com ',
      packId: 'mediano',
      provider: paymentProvider,
      returnUrls: { success: '/ok', pending: '/pending', failure: '/error' },
    })

    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID,
      pack_id: 'mediano',
      coins: 1725,
      provider: 'mercadopago',
      amount: 13000,
      currency: 'ARS',
    }))
    expect(paymentProvider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      reference: 'monedas:purchase-1',
      payer: { email: 'artista@example.com' },
      items: [expect.objectContaining({ unitPrice: 13000, currency: 'ARS' })],
    }))
    expect(db.update).toHaveBeenCalledWith({ checkout_id: 'checkout-1' })
    expect(result).toEqual({ url: 'https://checkout.example/pay', id: 'checkout-1', purchaseId: 'purchase-1' })
  })

  it('uses USD through PayPal and rejects unconfigured providers before writing', async () => {
    const paypal = provider('paypal')
    await createCoinPackCheckout({
      userId: USER_ID,
      email: 'artist@example.com',
      packId: 'mecenas',
      provider: paypal,
      returnUrls: { success: '/ok', pending: '/pending', failure: '/error' },
    })
    expect(paypal.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ unitPrice: 30, currency: 'USD' })],
    }))

    db.insert.mockClear()
    await expect(createCoinPackCheckout({
      userId: USER_ID,
      email: 'artist@example.com',
      packId: 'chico',
      provider: { ...provider('paypal'), isConfigured: false },
      returnUrls: { success: '/ok', pending: '/pending', failure: '/error' },
    })).rejects.toThrow('Invalid coin pack checkout')
    expect(db.insert).not.toHaveBeenCalled()
  })
})
