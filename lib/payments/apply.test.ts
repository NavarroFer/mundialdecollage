import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentProvider, ProviderPayment } from './provider'

const strategies = vi.hoisted(() => ({
  entry: { applyPayment: vi.fn(async () => 'paid' as const) },
  magazine: { applyPayment: vi.fn(async () => 'paid' as const) },
  workshop: { applyPayment: vi.fn(async () => 'paid' as const) },
}))
vi.mock('@/lib/entry-payments', () => ({ entryPurchase: strategies.entry }))
vi.mock('@/lib/magazine-payments', () => ({ magazinePurchase: strategies.magazine }))
vi.mock('@/lib/workshop-payments', () => ({ workshopPurchase: strategies.workshop }))

import { applyPayment, syncPayment } from './apply'

const payment = (reference: string | null): ProviderPayment => ({ provider: 'mercadopago', id: '1', status: 'approved', amount: 1, currency: 'ARS', reference })

beforeEach(() => {
  for (const strategy of Object.values(strategies)) strategy.applyPayment.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('applyPayment', () => {
  it('hands the payment to the purchase its reference names', async () => {
    await applyPayment(payment('entry:p1'))
    await applyPayment(payment('revista:o1'))
    await applyPayment(payment('r1'))
    expect(strategies.entry.applyPayment).toHaveBeenCalledWith('p1', expect.objectContaining({ id: '1' }))
    expect(strategies.magazine.applyPayment).toHaveBeenCalledWith('o1', expect.anything())
    expect(strategies.workshop.applyPayment).toHaveBeenCalledWith('r1', expect.anything())
  })

  it('applies only the kind a return page sells', async () => {
    expect(await applyPayment(payment('revista:o1'), 'entry')).toBeNull()
    expect(strategies.magazine.applyPayment).not.toHaveBeenCalled()
  })

  it('leaves subscription charges and unreferenced payments alone', async () => {
    expect(await applyPayment(payment('suscripcion:s1'))).toBeNull()
    expect(await applyPayment(payment(null))).toBeNull()
    for (const strategy of Object.values(strategies)) expect(strategy.applyPayment).not.toHaveBeenCalled()
  })
})

describe('syncPayment', () => {
  const provider = (fetchPayment: PaymentProvider['fetchPayment'], isConfigured = true): PaymentProvider => ({
    id: 'mercadopago',
    isConfigured,
    createCheckout: vi.fn(),
    fetchPayment,
  })

  it('applies what the provider reports', async () => {
    expect(await syncPayment(provider(async () => payment('entry:p1')), '1')).toBe('paid')
  })

  it('never throws when the provider fails, and does nothing unconfigured', async () => {
    expect(await syncPayment(provider(async () => { throw new Error('down') }), '1')).toBeNull()
    const fetchPayment = vi.fn()
    expect(await syncPayment(provider(fetchPayment, false), '1')).toBeNull()
    expect(fetchPayment).not.toHaveBeenCalled()
  })
})
