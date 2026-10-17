import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), search: vi.fn() }))
vi.mock('mercadopago', () => ({
  Preference: class {
    create = sdk.create
  },
  Payment: class {
    get = sdk.get
    search = sdk.search
  },
}))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true, getMercadoPagoConfig: () => ({}) }))

import { fromMercadoPagoPayment, mercadoPago, searchMercadoPagoPayments } from './mercadopago'

beforeEach(() => {
  sdk.create.mockReset()
  sdk.get.mockReset()
  sdk.search.mockReset()
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

  it('says when it was paid and who paid, as far as Mercado Pago tells', () => {
    const payment = fromMercadoPagoPayment({ id: 1, date_approved: '2026-10-16T12:00:00.000-04:00', payer: { email: 'ana@example.com', first_name: 'Ana', last_name: 'Paz' } })
    expect(payment.paidAt).toBe('2026-10-16T12:00:00.000-04:00')
    expect(payment.payer).toEqual({ email: 'ana@example.com', name: 'Ana Paz' })
    expect(fromMercadoPagoPayment({ id: 1, payer: { email: '' } }).payer).toBeUndefined()
  })

  it('says until when Mercado Pago holds the money («por acreditar»)', () => {
    expect(fromMercadoPagoPayment({ id: 1, status: 'approved', money_release_date: '2026-10-30T12:00:00.000-04:00' }).availableAt).toBe('2026-10-30T12:00:00.000-04:00')
    expect(fromMercadoPagoPayment({ id: 1, money_release_date: null }).availableAt).toBeUndefined()
  })
})

describe('searchMercadoPagoPayments', () => {
  it('reads every page of payments since the date', async () => {
    const page = (size: number, from: number) => ({ results: Array.from({ length: size }, (_, i) => ({ id: String(from + i), status: 'approved' })) })
    sdk.search.mockResolvedValueOnce(page(100, 0)).mockResolvedValueOnce(page(3, 100))
    const payments = await searchMercadoPagoPayments('2026-10-15T00:00:00.000-03:00')
    expect(payments).toHaveLength(103)
    expect(payments[0]).toMatchObject({ provider: 'mercadopago', id: '0', status: 'approved' })
    expect(sdk.search).toHaveBeenCalledTimes(2)
    expect(sdk.search).toHaveBeenLastCalledWith({ options: expect.objectContaining({ range: 'date_created', begin_date: '2026-10-15T00:00:00.000-03:00', offset: 100 }) })
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

  it('leaves the payer to Mercado Pago when there is none (a donation)', async () => {
    sdk.create.mockResolvedValue({ id: 'pref-2', init_point: 'https://mp/checkout' })
    await mercadoPago.createCheckout({
      reference: 'donacion:d1',
      items: [{ id: 'd', title: 'Donación', quantity: 1, unitPrice: 5000, currency: 'ARS' }],
      returnUrls: { success: 's', pending: 'p', failure: 'f' },
    })
    expect(sdk.create).toHaveBeenCalledWith({ body: expect.objectContaining({ payer: undefined, external_reference: 'donacion:d1' }) })
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
