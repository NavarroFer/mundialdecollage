import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => ({ syncPayment: vi.fn(), syncPreapprovalById: vi.fn(), recordAuthorizedPayment: vi.fn() }))
vi.mock('@/lib/payments/apply', () => ({ syncPayment: handlers.syncPayment }))
vi.mock('@/lib/payments/providers/mercadopago', () => ({ mercadoPago: { id: 'mercadopago' } }))
vi.mock('@/lib/mp-subscriptions', () => ({ syncPreapprovalById: handlers.syncPreapprovalById, recordAuthorizedPayment: handlers.recordAuthorizedPayment }))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true }))

import { POST } from './route'

const SECRET = 'webhook-secret'

function notification(type: string, id: string, { sign = true } = {}) {
  const ts = '1700000000'
  const requestId = 'req-1'
  const v1 = crypto.createHmac('sha256', SECRET).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex')
  return new NextRequest('https://mundialdecollage.com.ar/api/mercadopago/webhook', {
    method: 'POST',
    body: JSON.stringify({ type, data: { id } }),
    headers: sign ? { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${v1}` } : {},
  })
}

beforeEach(() => {
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', SECRET)
  for (const handler of Object.values(handlers)) handler.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Mercado Pago webhook', () => {
  it('sends each topic to its handler', async () => {
    expect((await POST(notification('payment', '123'))).status).toBe(200)
    expect((await POST(notification('subscription_preapproval', 'pre-1'))).status).toBe(200)
    expect((await POST(notification('subscription_authorized_payment', '456'))).status).toBe(200)
    expect(handlers.syncPayment).toHaveBeenCalledWith({ id: 'mercadopago' }, '123')
    expect(handlers.syncPreapprovalById).toHaveBeenCalledWith('pre-1')
    expect(handlers.recordAuthorizedPayment).toHaveBeenCalledWith('456')
  })

  it('rejects an unsigned or forged notification', async () => {
    expect((await POST(notification('payment', '123', { sign: false }))).status).toBe(401)
    const forged = notification('payment', '123')
    forged.headers.set('x-signature', 'ts=1700000000,v1=00')
    expect((await POST(forged)).status).toBe(401)
    expect(handlers.syncPayment).not.toHaveBeenCalled()
  })

  it('acknowledges topics it has nothing to do with', async () => {
    expect((await POST(notification('merchant_order', '1', { sign: false }))).status).toBe(200)
    expect((await POST(notification('constructor', '1', { sign: false }))).status).toBe(200)
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
  })
})
