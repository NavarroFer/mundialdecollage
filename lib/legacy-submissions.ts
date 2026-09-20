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

// A plain server-side fetch with no User-Agent reads as a bot to Drive and
// can get an HTML interstitial back instead of the file even when a normal
// browser wouldn't — every request below goes through this.
function fetchFromDrive(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  })
}

// Files too large for Drive to virus-scan come back as an HTML "download
// anyway?" page instead of the file, with a hidden form carrying a `confirm`
// token. Pulls every hidden input out of that form and replays them against
// whichever action URL the page itself points to (Drive has moved this
// between drive.google.com and drive.usercontent.google.com over time, so
// trusting the page's own action avoids hardcoding either).
function extractConfirmDownloadUrl(html: string, fileId: string): string | null {
  const actionMatch = html.match(/<form[^>]*action="([^"]+)"/)
  const action = actionMatch
    ? actionMatch[1].replace(/&amp;/g, '&')
    : 'https://drive.usercontent.google.com/download'

  const params = new URLSearchParams()
  for (const [, name, value] of html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)) {
    params.set(name, value)
  }
  if (!params.has('confirm')) return null
  if (!params.has('id')) params.set('id', fileId)

  return `${action}?${params.toString()}`
}

// One attempt at turning a Drive URL into image bytes: follows the
// virus-scan confirmation page when Drive serves one, then checks whatever
// it lands on is actually an image before returning it. Returns null (never
// throws) for anything that isn't a usable image, so callers can fall back
// to another URL.
async function tryDownloadImage(url: string, fileId: string): Promise<Buffer | null> {
  let response = await fetchFromDrive(url)
  if (!response.ok) return null

  let contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (contentType === 'text/html') {
    const confirmUrl = extractConfirmDownloadUrl(await response.text(), fileId)
    if (!confirmUrl) return null
    response = await fetchFromDrive(confirmUrl)
    if (!response.ok) return null
    contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? ''
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) return null

  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_FETCH_BYTES) return null

  const rawBuffer = Buffer.from(await response.arrayBuffer())
  if (rawBuffer.byteLength === 0 || rawBuffer.byteLength > MAX_FETCH_BYTES) return null
  return rawBuffer
}

// Downloads a submission's Drive photo and returns it resized/recompressed,
// ready to upload — or null for any failure (private file, non-image
// response, network error, corrupt data). Shared by both storage paths
// below; never throws, so a broken link for one artist never takes down a
// batch of others.
async function fetchOptimizedDriveImage(driveUrl: string | null): Promise<Buffer | null> {
  if (!driveUrl) return null
  const fileId = extractDriveFileId(driveUrl)
  if (!fileId) return null

  try {
    // The direct-download endpoint fails for files the owner marked
    // "viewers can't download/copy" — the file is still visible, just not
    // downloadable that way. The thumbnail endpoint renders a preview
    // instead of transferring the original bytes, which Drive allows even
    // under that restriction, so it's tried as a fallback rather than the
    // primary path (it re-encodes and may crop/cap resolution).
    const rawBuffer =
      (await tryDownloadImage(`https://drive.google.com/uc?export=download&id=${fileId}`, fileId)) ??
      (await tryDownloadImage(`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`, fileId))
    if (!rawBuffer) return null

    // Heavy submission photos (uncompressed phone shots, scans) get resized
    // and re-compressed here instead of being uploaded as-is — keeps
    // /obras/[slug] and the participants grid fast regardless of what
    // someone originally sent in.
    return await optimizeImage(rawBuffer)
  } catch (err) {
    console.error('legacy_submissions: image fetch failed', driveUrl, err)
    return null
  }
}

async function uploadOptimizedImage(
  supabase: SupabaseClient,
  path: string,
  buffer: Buffer,
): Promise<LegacyArtwork | null> {
  const { error: uploadError } = await supabase.storage
    .from('artworks')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) {
    console.error('legacy_submissions: image upload failed', path, uploadError)
    return null
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('artworks').getPublicUrl(path)
  return { path, publicUrl }
}

// Called once, lazily, at the exact moment a matched legacy_submissions row
// shows up at /onboarding with no `image_url` yet — a fallback for whatever
// the admin-triggered batch fetch (storeLegacyArtworkGlobally, run from
// /admin/obras) hasn't gotten to yet or couldn't fetch. Stored under this
// user's own folder since it's their session/client doing the upload.
export async function fetchAndStoreLegacyArtwork(
  supabase: SupabaseClient,
  userId: string,
  legacy: { id: string; drive_url: string | null },
): Promise<LegacyArtwork | null> {
  const buffer = await fetchOptimizedDriveImage(legacy.drive_url)
  if (!buffer) return null
  return uploadOptimizedImage(supabase, `${userId}/legacy-${legacy.id}.jpg`, buffer)
}

// The primary path: called from the admin-triggered batch (see
// fetchLegacyImagesBatch in app/admin/obras/actions.ts) right after import,
// so the photo lives in our own storage — durably, independent of whether or
// when that artist ever registers — instead of only ever existing as a Drive
// link that can break (unshared, deleted, Drive itself down) at any time.
// Uses the service-role client since there's no user session yet; stored
// under a `legacy/` prefix, separate from user-owned upload folders.
export async function storeLegacyArtworkGlobally(
  adminClient: SupabaseClient,
  legacy: { id: string; drive_url: string | null },
): Promise<LegacyArtwork | null> {
  const buffer = await fetchOptimizedDriveImage(legacy.drive_url)
  if (!buffer) return null
  return uploadOptimizedImage(adminClient, `legacy/${legacy.id}.jpg`, buffer)
}
