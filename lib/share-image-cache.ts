import { createHash } from 'node:crypto'
import { imageStore, isVersionedSource } from '@/lib/r2'

// An obra's link preview or story image costs satori + sharp 0.1–0.3 s of CPU
// to draw, and crawlers ask for the same one over and over (a single shared
// obra: 70+ times an hour), with no CDN in front: the locale comes from the
// request headers. The PNG only depends on what it draws, so R2 keeps it
// under a hash of exactly that — the text, the photo's version and the
// template itself (SHARE_IMAGE_TEMPLATE, a hash of its source made at build,
// next.config.mjs) — and a hit just reads it back.
const TEMPLATE = process.env.SHARE_IMAGE_TEMPLATE ?? 'dev'

// `complete` is false when the photo couldn't be loaded and the image went
// out without it: that one isn't kept, or it would stick.
export type Rendered = { image: Response; complete: boolean }

export async function cachedShareImage(
  drawn: unknown,
  photoUrl: string,
  render: () => Promise<Rendered>,
  format: 'png' | 'jpeg' = 'png',
): Promise<Response> {
  const store = imageStore()
  const key = store ? await shareImageKey(drawn, photoUrl, format) : null
  if (!store || !key) return (await render()).image

  try {
    const stored = await store.get(key)
    if (stored) return imageResponse(stored, format)
  } catch (error) {
    console.error('share image: R2 read failed', key, error)
  }

  const { image, complete } = await render()
  if (!complete) return image
  const body = Buffer.from(await image.arrayBuffer())
  try {
    await store.put(key, body, `image/${format}`)
  } catch (error) {
    console.error('share image: R2 write failed', key, error)
  }
  return imageResponse(body, format)
}

// A legacy photo can be overwritten in place, so its version (ETag) goes into
// the key; without one the image is drawn fresh rather than risk a stale one.
async function shareImageKey(drawn: unknown, photoUrl: string, format: 'png' | 'jpeg'): Promise<string | null> {
  let version: string | null = 'versioned'
  if (!isVersionedSource(photoUrl)) {
    try {
      const head = await fetch(photoUrl, { method: 'HEAD', cache: 'no-store' })
      version = head.ok ? (head.headers.get('etag') ?? head.headers.get('last-modified')) : null
    } catch {
      version = null
    }
  }
  if (!version) return null
  const hash = createHash('sha256').update(JSON.stringify([TEMPLATE, drawn, photoUrl, version])).digest('hex')
  return `share/${hash}.${format}`
}

function imageResponse(body: Buffer, format: 'png' | 'jpeg') {
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': `image/${format}` } })
}
