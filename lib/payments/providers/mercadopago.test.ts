import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn() }))
vi.mock('mercadopago', () => ({
  Preference: class {
    create = sdk.create
  },
  Payment: class {
    get = sdk.get
  },
}))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true, getMercadoPagoConfig: () => ({}) }))

import { fromMercadoPagoPayment, mercadoPago } from './mercadopago'

beforeEach(() => {
  sdk.create.mockReset()
  sdk.get.mockReset()
})

describe('fromMercadoPagoPayment', () => {
  it('reads Mercado Pago statuses in our terms', () => {
    const read = (status: string) => fromMercadoPagoPayment({ id: 1, status, transaction_amount: 10, currency_id: 'ARS', external_reference: 'x' }).status
    expect(read('approved')).toBe('approved')
    expect(read('refunded')).toBe('refunded')
    expect(read('charged_back')).toBe('refunded')
    expect(read('rejected')).toBe('rejected')
    expect(read('cancelled')).toBe('rejected')
    expect(read('in_process')).toBe('pending')
    expect(read('authorized')).toBe('pending')
  })

  it('fills in what Mercado Pago leaves out', () => {
    expect(fromMercadoPagoPayment({ id: 42 })).toEqual({ provider: 'mercadopago', id: '42', status: 'pending', amount: 0, currency: '', reference: null })
  })
})

describe('mercadoPago.createCheckout', () => {
  it('opens a Checkout Pro preference that comes back to the site', async () => {
    sdk.create.mockResolvedValue({ id: 'pref-1', init_point: 'https://mp/checkout' })
    const checkout = await mercadoPago.createCheckout({
      reference: 'entry:p1',
      items: [{ id: 'i', title: 'Obras', quantity: 1, unitPrice: 30000, currency: 'ARS' }],
      payer: { email: 'a@b.c' },
      returnUrls: { success: 's', pending: 'p', failure: 'f' },
    })
    expect(checkout).toEqual({ url: 'https://mp/checkout', id: 'pref-1' })
    expect(sdk.create).toHaveBeenCalledWith({
      body: expect.objectContaining({
        items: [{ id: 'i', title: 'Obras', quantity: 1, unit_price: 30000, currency_id: 'ARS' }],
        payer: { email: 'a@b.c', name: undefined },
        external_reference: 'entry:p1',
        back_urls: { success: 's', pending: 'p', failure: 'f' },
        auto_return: 'approved',
        notification_url: expect.stringMatching(/\/api\/mercadopago\/webhook$/),
      }),
    })
  })

  it('fails when Mercado Pago gives no page to go to', async () => {
    sdk.create.mockResolvedValue({ id: 'pref-1' })
    await expect(
      mercadoPago.createCheckout({ reference: 'r', items: [], payer: { email: 'a@b.c' }, returnUrls: { success: 's', pending: 'p', failure: 'f' } }),
    ).rejects.toThrow()
  })
})

describe('mercadoPago.fetchPayment', () => {
  it('only asks Mercado Pago about numeric ids', async () => {
    expect(await mercadoPago.fetchPayment('../etc')).toBeNull()
    expect(sdk.get).not.toHaveBeenCalled()
  })

  it('returns the payment in our terms', async () => {
    sdk.get.mockResolvedValue({ id: 9, status: 'approved', transaction_amount: 5, currency_id: 'ARS', external_reference: 'revista:o1' })
    expect(await mercadoPago.fetchPayment('9')).toMatchObject({ id: '9', status: 'approved', reference: 'revista:o1' })
  })
})
