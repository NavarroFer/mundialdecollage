import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { verifyResendSignature } from '@/lib/resend-signature'

// Resend's delivery-event webhook (configure at resend.com under Webhooks,
// pointing at this route, then put the signing secret in
// RESEND_WEBHOOK_SECRET). This is how campaign_sends learns that a send
// actually reached an inbox and whether it got opened — the send call itself
// only tells us Resend accepted the message, not what happened after.
const EVENT_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'opened', // a click implies an open, and some clients block the open pixel
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const id = request.headers.get('svix-id')
    const timestamp = request.headers.get('svix-timestamp')
    const signature = request.headers.get('svix-signature')

    if (!id || !timestamp || !signature || !verifyResendSignature({ id, timestamp, signature, body, secret })) {
      console.warn('resend webhook: signature missing or invalid, rejecting')
      return new NextResponse('Invalid signature', { status: 401 })
    }
  } else {
    console.warn('resend webhook: RESEND_WEBHOOK_SECRET not set, skipping signature verification')
  }

  let payload: { type?: string; created_at?: string; data?: { email_id?: string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return new NextResponse('Invalid payload', { status: 400 })
  }

  const event = payload.type ? EVENT_MAP[payload.type] : undefined
  const emailId = payload.data?.email_id

  if (!event || !emailId || !isSupabaseConfigured) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc('record_resend_event', {
    p_resend_email_id: emailId,
    p_event: event,
    p_occurred_at: payload.created_at ?? new Date().toISOString(),
  })

  if (error) {
    console.error('resend webhook: failed to record event', payload.type, emailId, error)
  }

  return NextResponse.json({ ok: true })
}
