import { Resend } from 'resend'

// Same pattern as isSupabaseConfigured: everything checks this first so the
// admin panel renders (in a disabled state) before real credentials exist.
export const isResendConfigured = Boolean(process.env.RESEND_API_KEY)

// Only call after checking isResendConfigured.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!)
}

// Resend's batch endpoint caps out at 100 emails per call.
export const RESEND_BATCH_SIZE = 100
