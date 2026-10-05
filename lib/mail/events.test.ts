import crypto from 'crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { brevoEvents, resendEvents } from './events'

// These decide which inbound calls get to touch campaign stats (and, for a
// spam complaint, unsubscribe a contact), and which provider events count.
const call = (headers: Record<string, string> = {}, url = 'https://x.test/api/brevo/webhook', body = '{}') =>
  ({ headers: new Headers(headers), url: new URL(url), body })

describe('brevoEvents', () => {
  const secret = 'brevo-secret'

  it('accepts the bearer token or a ?token= that matches', () => {
    expect(brevoEvents.verify(call({ authorization: `Bearer ${secret}` }), secret)).toBe(true)
    expect(brevoEvents.verify(call({}, `https://x.test/api/brevo/webhook?token=${secret}`), secret)).toBe(true)
  })

  it('rejects a missing or wrong token', () => {
    expect(brevoEvents.verify(call(), secret)).toBe(false)
    expect(brevoEvents.verify(call({ authorization: 'Bearer nope' }), secret)).toBe(false)
    expect(brevoEvents.verify(call({}, 'https://x.test/?token=brevo-secreT'), secret)).toBe(false)
  })

  it('maps Brevo events to ours, keyed by the message id the send returned', () => {
    const messageId = '<202610041242.20014638767@smtp-relay.mailin.fr>'
    const at = (event: string) => brevoEvents.parse({ event, 'message-id': messageId, ts_epoch: 1_759_582_920_000 })
    expect(at('delivered')).toEqual([{ messageId, event: 'delivered', occurredAt: new Date(1_759_582_920_000).toISOString() }])
    expect(at('opened')[0].event).toBe('opened')
    expect(at('click')[0].event).toBe('clicked')
    expect(at('hard_bounce')[0].event).toBe('bounced')
    expect(at('hardBounce')[0].event).toBe('bounced')
    expect(at('invalid_email')[0].event).toBe('bounced')
    expect(at('spam')[0].event).toBe('complained')
  })

  it("ignores events that would double-count or don't mean a final outcome", () => {
    for (const event of ['unique_opened', 'soft_bounce', 'request', 'deferred', 'unsubscribed']) {
      expect(brevoEvents.parse({ event, 'message-id': '<a@b>' })).toEqual([])
    }
    expect(brevoEvents.parse({ event: 'delivered' })).toEqual([])
  })

  it('takes batched payloads and falls back to ts_event seconds', () => {
    const events = brevoEvents.parse([
      { event: 'delivered', 'message-id': '<a@b>', ts_event: 1_759_582_920 },
      { event: 'opened', 'message-id': '<a@b>', ts_event: 1_759_582_980 },
    ])
    expect(events.map((e) => [e.event, e.occurredAt])).toEqual([
      ['delivered', new Date(1_759_582_920_000).toISOString()],
      ['opened', new Date(1_759_582_980_000).toISOString()],
    ])
  })
})

describe('resendEvents', () => {
  afterEach(() => { delete process.env.RESEND_WEBHOOK_SECRET })

  it('verifies the Svix signature from the headers', () => {
    const key = crypto.randomBytes(32)
    const secret = `whsec_${key.toString('base64')}`
    const body = JSON.stringify({ type: 'email.opened', data: { email_id: 'abc' } })
    const id = 'msg_1'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const sig = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
    const headers = { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${sig}` }
    expect(resendEvents.verify(call(headers, 'https://x.test/', body), secret)).toBe(true)
    expect(resendEvents.verify(call({ ...headers, 'svix-id': 'other' }, 'https://x.test/', body), secret)).toBe(false)
    expect(resendEvents.verify(call({}, 'https://x.test/', body), secret)).toBe(false)
  })

  it('maps Resend event types and skips unknown ones', () => {
    expect(resendEvents.parse({ type: 'email.clicked', created_at: '2026-10-04T12:00:00.000Z', data: { email_id: 'abc' } }))
      .toEqual([{ messageId: 'abc', event: 'clicked', occurredAt: '2026-10-04T12:00:00.000Z' }])
    expect(resendEvents.parse({ type: 'email.sent', data: { email_id: 'abc' } })).toEqual([])
  })

  it('reads its secret from the env at call time', () => {
    expect(resendEvents.secret()).toBeUndefined()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_x'
    expect(resendEvents.secret()).toBe('whsec_x')
  })
})
