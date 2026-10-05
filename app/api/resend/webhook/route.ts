import type { NextRequest } from 'next/server'
import { resendEvents } from '@/lib/mail/events'
import { handleMailWebhook } from '@/lib/mail/webhook'

// Resend's delivery events; see resendEvents in lib/mail/events.ts for setup.
export function POST(request: NextRequest) {
  return handleMailWebhook(resendEvents, request)
}
