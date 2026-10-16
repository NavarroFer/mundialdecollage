import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ paypal: vi.fn() }))
vi.mock('@/lib/payments/paypal/client', () => ({ isPayPalServerConfigured: true, paypal: api.paypal }))
vi.mock('@/lib/site', () => ({ getSiteUrl: () => 'https://mundial.test', site: { shortName: 'Mundial' } }))

import { capturePayPalOrder, fromPayPalCapture, payPal } from './paypal'

beforeEach(() => {
  api.paypal.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('fromPayPalCapture', () => {
  it('reads PayPal statuses in our terms', () => {
    const read = (status: string) => fromPayPalCapture({ id: 'CAP1', status }).status
    expect(read('COMPLETED')).toBe('approved')
    expect(read('REFUNDED')).toBe('refunded')
    expect(read('DECLINED')).toBe('rejected')
    expect(read('FAILED')).toBe('rejected')
    expect(read('PENDING')).toBe('pending')
    expect(read('PARTIALLY_REFUNDED')).toBe('pending')
  })

  it('keeps the amount, currency and reference', () => {
    expect(fromPayPalCapture({ id: 'CAP1', status: 'COMPLETED', custom_id: 'donacion:1', amount: { value: '10.00', currency_code: 'USD' } }))
      .toEqual({ provider: 'paypal', id: 'CAP1', status: 'approved', amount: 10, currency: 'USD', reference: 'donacion:1' })
  })
})

describe('payPal.createCheckout', () => {
  it('opens an order that comes back through the capture route', async () => {
    api.paypal.mockResolvedValue({ id: 'ORDER123', links: [{ rel: 'self', href: 'x' }, { rel: 'payer-action', href: 'https://paypal/approve' }] })
    const checkout = await payPal.createCheckout({
      reference: 'donacion:1',
      items: [{ id: 'mundial-donacion', title: 'Donación', quantity: 1, unitPrice: 10, currency: 'USD' }],
      returnUrls: { success: 'https://mundial.test/donar/gracias', pending: 'https://mundial.test/donar/gracias', failure: 'https://mundial.test/#donar' },
    })
    expect(checkout).toEqual({ url: 'https://paypal/approve', id: 'ORDER123' })
    const [path, { body, requestId }] = api.paypal.mock.calls[0]
    expect(path).toBe('/v2/checkout/orders')
    expect(requestId).toBe('checkout-donacion:1')
    expect(body.purchase_units[0]).toMatchObject({ custom_id: 'donacion:1', amount: { currency_code: 'USD', value: '10.00' } })
    const context = body.payment_source.paypal.experience_context
    expect(context.shipping_preference).toBe('NO_SHIPPING')
    const back = new URL(context.return_url)
    expect(back.origin + back.pathname).toBe('https://mundial.test/api/paypal/return')
    expect(back.searchParams.get('success')).toBe('https://mundial.test/donar/gracias')
    expect(back.searchParams.get('failure')).toBe('https://mundial.test/#donar')
    expect(new URL(context.cancel_url).searchParams.get('cancel')).toBe('1')
    expect(body.payment_source.paypal.email_address).toBeUndefined()
  })

  it('refuses items in more than one currency', async () => {
    await expect(payPal.createCheckout({
      reference: 'r',
      items: [{ id: 'a', title: 'A', quantity: 1, unitPrice: 1, currency: 'USD' }, { id: 'b', title: 'B', quantity: 1, unitPrice: 1, currency: 'ARS' }],
      returnUrls: { success: 's', pending: 'p', failure: 'f' },
    })).rejects.toThrow()
    expect(api.paypal).not.toHaveBeenCalled()
  })

  it('fails when PayPal gives no page to send the buyer to', async () => {
    api.paypal.mockResolvedValue({ id: 'ORDER123', links: [] })
    await expect(payPal.createCheckout({
      reference: 'r',
      items: [{ id: 'a', title: 'A', quantity: 1, unitPrice: 5, currency: 'USD' }],
      returnUrls: { success: 's', pending: 'p', failure: 'f' },
    })).rejects.toThrow(/checkout URL/)
  })
})

describe('capturePayPalOrder', () => {
  it('takes the money of an approved order, once', async () => {
    api.paypal.mockResolvedValue({ id: 'ORDER123', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED' }] } }] })
    expect(await capturePayPalOrder('ORDER123')).toBe('approved')
    expect(api.paypal).toHaveBeenCalledWith('/v2/checkout/orders/ORDER123/capture', { method: 'POST', requestId: 'capture-ORDER123' })
  })

  it('reads a capture still under review as pending', async () => {
    api.paypal.mockResolvedValue({ id: 'ORDER123', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'PENDING' }] } }] })
    expect(await capturePayPalOrder('ORDER123')).toBe('pending')
  })

  it('takes an order captured before as paid, and a refused one as not', async () => {
    api.paypal.mockRejectedValueOnce(Object.assign(new Error('UNPROCESSABLE_ENTITY'), { causes: [{ code: 'ORDER_ALREADY_CAPTURED' }] }))
    expect(await capturePayPalOrder('ORDER123')).toBe('approved')
    api.paypal.mockRejectedValueOnce(Object.assign(new Error('UNPROCESSABLE_ENTITY'), { causes: [{ code: 'INSTRUMENT_DECLINED' }] }))
    expect(await capturePayPalOrder('ORDER123')).toBe('rejected')
  })

  it('never puts something that is not an order id into the API path', async () => {
    expect(await capturePayPalOrder('../v1/oauth2')).toBe('rejected')
    expect(await capturePayPalOrder('')).toBe('rejected')
    expect(api.paypal).not.toHaveBeenCalled()
  })
})
