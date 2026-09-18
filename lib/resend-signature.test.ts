import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import { verifyResendSignature } from './resend-signature'

// The webhook route (app/api/resend/webhook/route.ts) is the one place that
// decides whether to trust an inbound delivery/open/bounce event — a bypass
// here means anyone could fake "opened" stats or trigger a spam-complaint
// unsubscribe for an arbitrary contact.
describe('verifyResendSignature', () => {
  const secretBytes = crypto.randomBytes(32)
  const secret = `whsec_${secretBytes.toString('base64')}`
  const id = 'msg_123'
  const body = JSON.stringify({ type: 'email.opened', data: { email_id: 'abc' } })

  function sign(timestamp: string) {
    return crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`).digest('base64')
  }

  it('accepts a signature computed the same way Resend/Svix computes it', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = `v1,${sign(timestamp)}`
    expect(verifyResendSignature({ id, timestamp, signature, body, secret })).toBe(true)
  })

  it('accepts a match among multiple space-separated signatures', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = `v1,not-the-real-one v1,${sign(timestamp)}`
    expect(verifyResendSignature({ id, timestamp, signature, body, secret })).toBe(true)
  })

  it('rejects a signature made with the wrong secret', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const wrongSig = crypto
      .createHmac('sha256', crypto.randomBytes(32))
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')
    expect(verifyResendSignature({ id, timestamp, signature: `v1,${wrongSig}`, body, secret })).toBe(false)
  })

  it('rejects when the body is tampered with', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = `v1,${sign(timestamp)}`
    const tamperedBody = JSON.stringify({ type: 'email.opened', data: { email_id: 'evil' } })
    expect(verifyResendSignature({ id, timestamp, signature, body: tamperedBody, secret })).toBe(false)
  })

  it('rejects a stale timestamp outside the tolerance window', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600)
    const signature = `v1,${sign(timestamp)}`
    expect(verifyResendSignature({ id, timestamp, signature, body, secret })).toBe(false)
  })

  it('rejects a malformed signature header without throwing', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    expect(() => verifyResendSignature({ id, timestamp, signature: 'garbage', body, secret })).not.toThrow()
    expect(verifyResendSignature({ id, timestamp, signature: 'garbage', body, secret })).toBe(false)
  })
})
