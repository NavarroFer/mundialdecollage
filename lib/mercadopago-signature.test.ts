import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import { parseSignatureHeader, verifyMercadoPagoSignature } from './mercadopago-signature'

describe('parseSignatureHeader', () => {
  it('extracts ts and v1 regardless of order', () => {
    expect(parseSignatureHeader('ts=1700000000,v1=abc123')).toEqual({
      ts: '1700000000',
      v1: 'abc123',
    })
    expect(parseSignatureHeader('v1=abc123,ts=1700000000')).toEqual({
      ts: '1700000000',
      v1: 'abc123',
    })
  })

  it('tolerates extra whitespace around keys/values', () => {
    expect(parseSignatureHeader('ts=1, v1=deadbeef')).toEqual({ ts: '1', v1: 'deadbeef' })
  })

  it('returns an empty object for a missing or malformed header', () => {
    expect(parseSignatureHeader(null)).toEqual({})
    expect(parseSignatureHeader('')).toEqual({})
    expect(parseSignatureHeader('garbage')).toEqual({})
  })
})

// The webhook route (app/api/mercadopago/webhook/route.ts) is the one place
// in the app that decides whether to trust an inbound payment notification —
// a bypass here means anyone could fake a "paid" workshop registration.
describe('verifyMercadoPagoSignature', () => {
  const secret = 'test-secret'
  const paymentId = '123456789'
  const requestId = 'req-1'
  const ts = '1700000000'

  function sign(manifest: string) {
    return crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  }

  it('accepts a signature computed the same way Mercado Pago computes it', () => {
    const v1 = sign(`id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    expect(verifyMercadoPagoSignature({ paymentId, requestId, ts, v1, secret })).toBe(true)
  })

  it('rejects a signature made with the wrong secret', () => {
    const v1 = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(`id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest('hex')
    expect(verifyMercadoPagoSignature({ paymentId, requestId, ts, v1, secret })).toBe(false)
  })

  it('rejects when any manifest field is tampered with', () => {
    const v1 = sign(`id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    expect(
      verifyMercadoPagoSignature({ paymentId: '999999999', requestId, ts, v1, secret }),
    ).toBe(false)
    expect(
      verifyMercadoPagoSignature({ paymentId, requestId: 'different-request', ts, v1, secret }),
    ).toBe(false)
    expect(verifyMercadoPagoSignature({ paymentId, requestId, ts: '1', v1, secret })).toBe(false)
  })

  it('rejects a malformed (non-hex or wrong-length) v1 without throwing', () => {
    expect(() =>
      verifyMercadoPagoSignature({ paymentId, requestId, ts, v1: 'not-hex!!', secret }),
    ).not.toThrow()
    expect(
      verifyMercadoPagoSignature({ paymentId, requestId, ts, v1: 'not-hex!!', secret }),
    ).toBe(false)
    expect(verifyMercadoPagoSignature({ paymentId, requestId, ts, v1: 'ab', secret })).toBe(false)
  })

  it('lowercases the payment id per spec, but not request-id', () => {
    const v1 = sign(`id:abc123;request-id:REQ-1;ts:${ts};`)
    // Passing the uppercased id still validates because verify() lowercases
    // it before building the manifest.
    expect(
      verifyMercadoPagoSignature({ paymentId: 'ABC123', requestId: 'REQ-1', ts, v1, secret }),
    ).toBe(true)
    // request-id is used verbatim — a differently-cased one must not match.
    expect(
      verifyMercadoPagoSignature({ paymentId: 'ABC123', requestId: 'req-1', ts, v1, secret }),
    ).toBe(false)
  })
})
