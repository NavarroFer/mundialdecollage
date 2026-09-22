import { createHmac, timingSafeEqual } from 'node:crypto'

export function normalizeLikeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null
}

export function signGalleryIdentity(email: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ email, expires: Date.now() + 365 * 86400000 })).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

export function readGalleryIdentity(token: string | undefined, secret: string): string | null {
  if (!token) return null
  try {
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra) return null
    const expected = createHmac('sha256', secret).update(payload).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof data.expires === 'number' && data.expires > Date.now() ? normalizeLikeEmail(data.email) : null
  } catch {
    return null
  }
}
