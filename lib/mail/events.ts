// What each provider tells us after a mail went out — delivered, opened,
// clicked, bounced, marked as spam — behind one interface, the inbound twin
// of lib/mail/transports.ts (strategy pattern): each provider checks that a
// webhook call is really its own and turns its payload into MailEvents keyed
// by the id its send call returned, which is what campaign_sends stores.
import crypto from 'crypto'
import { verifyResendSignature } from '@/lib/resend-signature'
import type { MailProvider } from '@/lib/mail-quota'

export type MailEventType = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'

export type MailEvent = { messageId: string; event: MailEventType; occurredAt: string }

export type WebhookCall = { headers: Headers; url: URL; body: string }

export interface MailEventSource {
  provider: MailProvider
  /** The shared secret the provider proves itself with; unset means refuse everything. */
  secret(): string | undefined
  verify(call: WebhookCall, secret: string): boolean
  parse(payload: unknown): MailEvent[]
}

const RESEND_EVENTS: Record<string, MailEventType> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

// Configure at resend.com → Webhooks, pointing at /api/resend/webhook, with
// the signing secret in RESEND_WEBHOOK_SECRET.
export const resendEvents: MailEventSource = {
  provider: 'resend',
  secret: () => process.env.RESEND_WEBHOOK_SECRET,
  verify({ headers, body }, secret) {
    const id = headers.get('svix-id')
    const timestamp = headers.get('svix-timestamp')
    const signature = headers.get('svix-signature')
    return Boolean(id && timestamp && signature && verifyResendSignature({ id, timestamp, signature, body, secret }))
  },
  parse(payload) {
    const { type, created_at, data } = (payload ?? {}) as { type?: string; created_at?: string; data?: { email_id?: string } }
    const event = type ? RESEND_EVENTS[type] : undefined
    if (!event || !data?.email_id) return []
    return [{ messageId: data.email_id, event, occurredAt: created_at ?? new Date().toISOString() }]
  },
}

// Brevo names events snake_case in webhooks and camelCase elsewhere, so both
// are compared without underscores. The unique_* opens are left out: Brevo
// sends them alongside the plain "opened" of the same open, which would count
// it twice. A hard bounce, a block or an invalid address all mean the mail
// never arrives; a soft bounce may still be retried, so it isn't one.
const BREVO_EVENTS: Record<string, MailEventType> = {
  delivered: 'delivered',
  opened: 'opened',
  click: 'clicked',
  hardbounce: 'bounced',
  blocked: 'bounced',
  invalid: 'bounced',
  invalidemail: 'bounced',
  spam: 'complained',
}

type BrevoEvent = { event?: string; 'message-id'?: string; ts_epoch?: number; ts_event?: number; ts?: number }

function brevoTime({ ts_epoch, ts_event, ts }: BrevoEvent) {
  // `date` is in the account's timezone; the epoch fields aren't.
  const ms = ts_epoch ?? (ts_event ?? ts ?? 0) * 1000
  return ms > 0 ? new Date(ms).toISOString() : new Date().toISOString()
}

function sameSecret(received: string | null, secret: string) {
  if (!received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Brevo doesn't sign webhooks: it sends back the bearer token the webhook was
// created with (Brevo → Transactional → Webhooks, or POST /v3/webhooks with
// auth.type "bearer"), or the URL can carry it as ?token=. Either must match
// BREVO_WEBHOOK_SECRET. Points at /api/brevo/webhook.
export const brevoEvents: MailEventSource = {
  provider: 'brevo',
  secret: () => process.env.BREVO_WEBHOOK_SECRET,
  verify({ headers, url }, secret) {
    const bearer = headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
    return sameSecret(bearer, secret) || sameSecret(url.searchParams.get('token'), secret)
  },
  parse(payload) {
    const items = (Array.isArray(payload) ? payload : [payload]) as BrevoEvent[]
    return items.flatMap((item) => {
      const event = BREVO_EVENTS[(item?.event ?? '').replace(/_/g, '').toLowerCase()]
      const messageId = item?.['message-id']
      return event && messageId ? [{ messageId, event, occurredAt: brevoTime(item) }] : []
    })
  },
}
