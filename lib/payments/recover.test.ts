import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderPayment } from './provider'

const search = vi.hoisted(() => vi.fn())
const apply = vi.hoisted(() => vi.fn())
const subscriptions = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payments/providers/mercadopago', () => ({ searchMercadoPagoPayments: search }))
vi.mock('@/lib/payments/apply', () => ({ applyPayment: apply }))
vi.mock('@/lib/mp-subscriptions', () => ({ recoverMercadoPagoSubscriptions: subscriptions }))

import { MERCADO_PAGO_START, recoverMercadoPago } from './recover'

const payment = (id: string, reference: string | null): ProviderPayment => ({
  provider: 'mercadopago',
  id,
  status: 'approved',
  amount: 5000,
  currency: 'ARS',
  reference,
})

beforeEach(() => {
  search.mockReset()
  apply.mockReset().mockResolvedValue('paid')
  subscriptions.mockReset().mockResolvedValue({ subscriptions: 1, charges: 1 })
})

describe('recoverMercadoPago', () => {
  it('applies every payment of the Mercado Pago charges since they began, and the store subscriptions', async () => {
    const donation = payment('1', 'donacion:7d2c0a4e-0000-4000-8000-000000000000')
    const entry = payment('2', 'entry:p1')
    const magazine = payment('3', 'revista:o1')
    const coinPack = payment('4', 'monedas:c1')
    search.mockResolvedValue([donation, entry, magazine, coinPack])
    expect(await recoverMercadoPago()).toEqual({ 'coin-pack': 1, donation: 1, entry: 1, magazine: 1, subscriptions: 1, charges: 1 })
    expect(search).toHaveBeenCalledWith(MERCADO_PAGO_START)
    expect(apply).toHaveBeenCalledWith(donation, 'donation')
    expect(apply).toHaveBeenCalledWith(entry, 'entry')
    expect(apply).toHaveBeenCalledWith(magazine, 'magazine')
    expect(apply).toHaveBeenCalledWith(coinPack, 'coin-pack')
  })

  it("leaves alone what isn't clearly the Mundial's: other businesses on the same account, the subscriptions' own charges", async () => {
    search.mockResolvedValue([
      payment('1', null),
      payment('2', 'pampa-plan-pro'),
      payment('3', '7d2c0a4e-0000-4000-8000-000000000000'),
      payment('4', 'suscripcion:s1'),
    ])
    expect(await recoverMercadoPago()).toMatchObject({ 'coin-pack': 0, donation: 0, entry: 0, magazine: 0 })
    expect(apply).not.toHaveBeenCalled()
  })
})
