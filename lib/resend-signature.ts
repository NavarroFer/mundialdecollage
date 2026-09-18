import crypto from 'crypto'

// Resend signs webhooks the way Svix does: secret is "whsec_" + base64(key),
// and the signed content is "{id}.{timestamp}.{raw body}" — must be the raw
// text body, not a re-serialized JSON.parse/stringify round trip, or the
// signature won't match. svix-signature can carry multiple "v1,<sig>" tokens
// space-separated (key rotation), so a match on any of them is valid.
const TOLERANCE_SECONDS = 5 * 60

export function verifyResendSignature({
  id,
  timestamp,
  signature,
  body,
  secret,
}: {
  id: string
  timestamp: string
  signature: string
  body: string
  secret: string
}): boolean {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`).digest('base64')
  const expectedBuffer = Buffer.from(expected, 'base64')

  return signature.split(' ').some((token) => {
    const [, sig] = token.split(',')
    if (!sig) return false
    const receivedBuffer = Buffer.from(sig, 'base64')
    return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  })
}
