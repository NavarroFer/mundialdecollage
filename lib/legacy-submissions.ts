import type { SupabaseClient } from '@supabase/supabase-js'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'

// The spreadsheet always stores links shaped like
// ".../file/d/<FILE_ID>/view?usp=sharing" — pull just the id out so we can
// hit Drive's direct-download endpoint instead of the viewer page.
export function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/)
  return match ? match[1] : null
}

export type LegacyArtwork = { path: string; publicUrl: string }

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
    if (contentLength > MAX_IMAGE_BYTES) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null

    const extension = contentType.split('/')[1] || 'jpg'
    const path = `${userId}/legacy-${legacy.id}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('artworks')
      .upload(path, buffer, { contentType, upsert: true })
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
