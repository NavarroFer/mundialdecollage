import crypto from 'crypto'

// x-signature looks like "ts=1700000000,v1=abcdef0123..." — order isn't
// guaranteed, so parse key by key instead of assuming position.
export function parseSignatureHeader(header: string | null): { ts?: string; v1?: string } {
  const result: { ts?: string; v1?: string } = {}
  if (!header) return result
  for (const part of header.split(',')) {
    const [key, value] = part.split('=').map((s) => s.trim())
    if (key === 'ts') result.ts = value
    if (key === 'v1') result.v1 = value
  }
  return result
}

// Manifest format per Mercado Pago docs: id:{data.id};request-id:{x-request-id};ts:{ts};
// (data.id lowercased per their spec — a no-op for numeric payment ids).
// Timing-safe by construction: Buffer comparison always uses
// crypto.timingSafeEqual, never ===, so a mismatch can't be timed byte by byte.
export function verifyMercadoPagoSignature({
  paymentId,
  requestId,
  ts,
  v1,
  secret,
}: {
  paymentId: string
  requestId: string
  ts: string
  v1: string
  secret: string
}): boolean {
  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(v1, 'hex')
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}
