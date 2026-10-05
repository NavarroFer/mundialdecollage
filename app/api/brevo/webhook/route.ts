import type { NextRequest } from 'next/server'
import { brevoEvents } from '@/lib/mail/events'
import { handleMailWebhook } from '@/lib/mail/webhook'

// Brevo's transactional events; see brevoEvents in lib/mail/events.ts for setup.
export function POST(request: NextRequest) {
  return handleMailWebhook(brevoEvents, request)
}
