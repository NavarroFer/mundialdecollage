import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_FETCH_BYTES } from '@/lib/onboarding-image'

// The spreadsheet always stores links shaped like
// ".../file/d/<FILE_ID>/view?usp=sharing" — pull just the id out so we can
// hit Drive's direct-download endpoint instead of the viewer page.
export function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  return match ? match[1] : null
}

export type LegacyArtwork = { path: string; publicUrl: string }

// Longest side a submission photo ever needs to render at (the biggest
// display on the site is the full-width image on /obras/[slug]) — anything
// bigger is wasted bytes on every page load.
const MAX_DIMENSION = 2000

// Re-encodes to JPEG at decreasing quality until it fits MAX_IMAGE_BYTES, or
// gives up after a few tries and returns its best (smallest) attempt. These
// are phone photos of a physical artwork, not screenshots or line art, so
// JPEG's lossy compression is the right tool — a raw phone photo/scan can
// easily be 10-20MB, almost entirely resolution and JPEG quality nobody
// benefits from on a web page.
export async function optimizeImage(input: Buffer): Promise<Buffer | null> {
  try {
    const resized = sharp(input).rotate().resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })

    let best: Buffer | null = null
    for (const quality of [82, 70, 55, 40]) {
      const attempt = await resized.clone().jpeg({ quality, mozjpeg: true }).toBuffer()
      if (!best || attempt.byteLength < best.byteLength) best = attempt
      if (attempt.byteLength <= MAX_IMAGE_BYTES) return attempt
    }
    return best
  } catch {
    // Not a decodable image (corrupt file, or Drive served an HTML error
    // page instead of the photo) — let the caller fall back gracefully.
    return null
  }
}

// Called once, lazily, at the exact moment a matched legacy_submissions row
// shows up at /onboarding — never in bulk during the admin import. Fetching
// ~90 Drive files in one import request risks a serverless timeout and
// wastes storage on people who never actually register.
//
// Never throws: any failure (private file, non-image response, network
// error, oversized file) just returns null, and the caller falls back to
// prefilling the name only — same as a normal onboarding where nobody
// uploaded anything yet.
export async function fetchAndStoreLegacyArtwork(
  supabase: SupabaseClient,
  userId: string,
  legacy: { id: string; drive_url: string | null },
): Promise<LegacyArtwork | null> {
  if (!legacy.drive_url) return null
  const fileId = extractDriveFileId(legacy.drive_url)
  if (!fileId) return null

  try {
    const response = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? ''
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null

    const contentLength = Number(response.headers.get('content-length') ?? '0')
    if (contentLength > MAX_FETCH_BYTES) return null

    const rawBuffer = Buffer.from(await response.arrayBuffer())
    if (rawBuffer.byteLength === 0 || rawBuffer.byteLength > MAX_FETCH_BYTES) return null

    // Heavy submission photos (uncompressed phone shots, scans) get resized
    // and re-compressed here instead of being uploaded as-is — keeps
    // /obras/[slug] and the participants grid fast regardless of what
    // someone originally sent in.
    const buffer = await optimizeImage(rawBuffer)
    if (!buffer) return null

    const path = `${userId}/legacy-${legacy.id}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('artworks')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
    if (uploadError) {
      console.error('legacy_submissions: image upload failed', legacy.id, uploadError)
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('artworks').getPublicUrl(path)
    return { path, publicUrl }
  } catch (err) {
    console.error('legacy_submissions: image fetch failed', legacy.id, err)
    return null
  }
}
