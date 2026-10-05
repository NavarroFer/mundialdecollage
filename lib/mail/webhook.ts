// The one webhook handler behind /api/resend/webhook and /api/brevo/webhook:
// checks the call came from the provider, then applies each event to the
// campaign_sends row with that provider's message id (record_resend_event,
// which despite its name matches any provider's id — the column holds
// whatever id the send call returned). The send call only says the provider
// accepted a mail; this is how delivered/opened/clicked get filled in.
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { MailEventSource } from '@/lib/mail/events'

export async function handleMailWebhook(source: MailEventSource, request: NextRequest) {
  const body = await request.text()

  const secret = source.secret()
  if (!secret) {
    console.error(`${source.provider} webhook: secret not set, refusing unauthenticated events`)
    return new NextResponse('Webhook is not configured', { status: 503 })
  }
  if (!source.verify({ headers: request.headers, url: request.nextUrl, body }, secret)) {
    console.warn(`${source.provider} webhook: credentials missing or invalid, rejecting`)
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return new NextResponse('Invalid payload', { status: 400 })
  }

  const events = source.parse(payload)
  if (!events.length || !isSupabaseConfigured) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  for (const { messageId, event, occurredAt } of events) {
    const { error } = await supabase.rpc('record_resend_event', {
      p_resend_email_id: messageId,
      p_event: event,
      p_occurred_at: occurredAt,
    })
    if (error) console.error(`${source.provider} webhook: failed to record event`, event, messageId, error)
  }

  return NextResponse.json({ ok: true })
}
