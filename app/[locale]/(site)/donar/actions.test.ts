import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  createPayPalCheckout: vi.fn(),
  redirect: vi.fn(),
  track: vi.fn(),
  configured: { value: true },
  paypalConfigured: { value: true },
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/track-server', () => ({ trackServer: mocks.track }))
vi.mock('@/lib/site', () => ({ getSiteUrl: () => 'https://mundial.test', site: { name: 'Mundial' } }))
vi.mock('@/lib/payments/providers/mercadopago', () => ({
  mercadoPago: {
    id: 'mercadopago',
    get isConfigured() { return mocks.configured.value },
    createCheckout: mocks.createCheckout,
  },
}))
vi.mock('@/lib/payments/providers/paypal', () => ({
  payPal: {
    id: 'paypal',
    get isConfigured() { return mocks.paypalConfigured.value },
    createCheckout: mocks.createPayPalCheckout,
  },
}))
import { startDonation } from './actions'

const initial = { error: null }
function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.configured.value = true
  mocks.paypalConfigured.value = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('startDonation', () => {
  it('sends the donor to Mercado Pago for the amount they tapped', async () => {
    mocks.createCheckout.mockResolvedValue({ url: 'https://mp/checkout', id: 'pref' })
    await startDonation(initial, form({ amount: '10000', from: 'gallery' }))
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      reference: expect.stringMatching(/^donacion:[0-9a-f-]{36}$/),
      items: [expect.objectContaining({ quantity: 1, unitPrice: 10000, currency: 'ARS' })],
      returnUrls: { success: 'https://mundial.test/donar/gracias', pending: 'https://mundial.test/donar/gracias', failure: 'https://mundial.test/galeria-3d' },
    })
    expect(mocks.createPayPalCheckout).not.toHaveBeenCalled()
    expect(mocks.track).toHaveBeenCalledWith('donation_checkout_start_gallery', null)
    expect(mocks.redirect).toHaveBeenCalledWith('https://mp/checkout')
  })

  it('brings a failed payment from the home back to its donation section', async () => {
    mocks.createCheckout.mockResolvedValue({ url: 'https://mp/checkout', id: 'pref' })
    await startDonation(initial, form({ amount: '$ 15.000' }))
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ unitPrice: 15000 })],
      returnUrls: expect.objectContaining({ failure: 'https://mundial.test/#donar' }),
    }))
    expect(mocks.track).toHaveBeenCalledWith('donation_checkout_start_home', null)
  })

  it('sends a donation in dollars to PayPal, with the same ways back', async () => {
    mocks.createPayPalCheckout.mockResolvedValue({ url: 'https://paypal/checkout', id: 'ORDER1' })
    await startDonation(initial, form({ amount: '10', currency: 'USD' }))
    expect(mocks.createPayPalCheckout).toHaveBeenCalledWith({
      reference: expect.stringMatching(/^donacion:[0-9a-f-]{36}$/),
      items: [expect.objectContaining({ quantity: 1, unitPrice: 10, currency: 'USD' })],
      returnUrls: { success: 'https://mundial.test/donar/gracias', pending: 'https://mundial.test/donar/gracias', failure: 'https://mundial.test/#donar' },
    })
    expect(mocks.createCheckout).not.toHaveBeenCalled()
    expect(mocks.track).toHaveBeenCalledWith('donation_checkout_start_home', null)
    expect(mocks.track).toHaveBeenCalledWith('donation_checkout_start_paypal', null)
    expect(mocks.redirect).toHaveBeenCalledWith('https://paypal/checkout')
  })

  it('asks again for an amount out of range, without calling a provider', async () => {
    expect(await startDonation(initial, form({ amount: '10' }))).toEqual({ error: 'invalid', currency: 'ARS' })
    expect(await startDonation(initial, form({ amount: '5000', currency: 'USD' }))).toEqual({ error: 'invalid', currency: 'USD' })
    expect(mocks.createCheckout).not.toHaveBeenCalled()
    expect(mocks.createPayPalCheckout).not.toHaveBeenCalled()
  })

  it('says so when the provider is off or refuses', async () => {
    mocks.configured.value = false
    expect(await startDonation(initial, form({ amount: '5000' }))).toEqual({ error: 'unavailable', currency: 'ARS' })
    mocks.configured.value = true
    mocks.createCheckout.mockRejectedValue(new Error('down'))
    expect(await startDonation(initial, form({ amount: '5000' }))).toEqual({ error: 'unavailable', currency: 'ARS' })
    mocks.paypalConfigured.value = false
    expect(await startDonation(initial, form({ amount: '5', currency: 'USD' }))).toEqual({ error: 'unavailable', currency: 'USD' })
    mocks.paypalConfigured.value = true
    mocks.createPayPalCheckout.mockRejectedValue(new Error('down'))
    expect(await startDonation(initial, form({ amount: '5', currency: 'USD' }))).toEqual({ error: 'unavailable', currency: 'USD' })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
