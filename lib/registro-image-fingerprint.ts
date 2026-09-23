import { createHash } from 'node:crypto'
import sharp from 'sharp'

// Compare the visible pixels, not file bytes: Drive copies and Storage
// re-encodings can have different metadata or formats for the same artwork.
export async function registroImageFingerprint(image: Buffer): Promise<string> {
  const pixels = await sharp(image).rotate().resize(128, 128, { fit: 'fill' })
    .removeAlpha().raw().toBuffer()
  return createHash('sha256').update(pixels).digest('hex')
}
