import { createHmac, timingSafeEqual } from 'node:crypto'

// The ?t= on the certificate links mailed when the call closes
// (lib/certificate-mail.ts): many artists came from the Registro sheet and
// may never sign in, so the link itself proves it was ours. An HMAC of the
// slug, so it never expires and needs nothing stored.

const TOKEN_LENGTH = 32

/** The signing secret, or null when neither variable is set (then no link can be signed or checked). */
export function certificateSecret(): string | null {
  return process.env.CERTIFICATE_SECRET || process.env.CRON_SECRET || null
}

export function certificateToken(slug: string, secret: string): string {
  return createHmac('sha256', secret).update(slug).digest('hex').slice(0, TOKEN_LENGTH)
}

export function isValidCertificateToken(slug: string, token: string | null | undefined, secret: string | null): boolean {
  if (!secret || !token || token.length !== TOKEN_LENGTH) return false
  // Timing-safe so the token can't be guessed one character at a time.
  return timingSafeEqual(Buffer.from(token), Buffer.from(certificateToken(slug, secret)))
}
