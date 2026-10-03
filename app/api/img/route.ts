import sharp from 'sharp'
import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/lib/image-widths.mjs'
import { MAX_FETCH_BYTES } from '@/lib/onboarding-image'
import { imageStore, imageStorePrefix, type ImageStore } from '@/lib/r2'

// Resizes a public Storage image for lib/image-loader.ts. Vercel's own image
// optimization returned 402 once its allowance ran out, so this does the
// same with sharp: the CDN caches each (url, width) pair, and the function
// only runs on a miss — which is often: the CDN cache is per region and
// starts empty after a deploy, so what a miss needs is kept in R2 (lib/r2.ts).
// A day of freshness, then stale-while-revalidate, since a few paths
// (legacy/<id>.jpg) are overwritten in place when re-synced.
const CACHE = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const src = params.get('url') ?? ''
  const width = Number(params.get('w'))

  // Only this project's public bucket — otherwise it's an open image proxy.
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !src.startsWith(prefix) || src.includes('..')) {
    return new Response('Bad url', { status: 400 })
  }
  if (!IMAGE_WIDTHS.includes(width)) return new Response('Bad width', { status: 400 })

  // With R2 configured, Storage is asked for the photo itself once per
  // version; every later miss — another width, another CDN region, the cache
  // emptied by a deploy — is answered from R2. The HEAD (no body) is how an
  // overwritten photo is noticed.
  const store = imageStore()
  let folder: string | null = null
  let original: Buffer | null = null
  if (store) {
    try {
      const head = await fetch(src, { method: 'HEAD', cache: 'no-store' })
      if (head.status === 404) return notFound(404)
      const version = head.headers.get('etag') ?? head.headers.get('last-modified')
      if (head.ok && version) folder = imageStorePrefix(src, version)
      if (!folder) console.warn('api/img: no ETag from Storage, not using R2', src, head.status)
      if (folder) {
        const stored = await store.get(`${folder}/${width}.webp`)
        if (stored) return webp(stored)
        original = await store.get(`${folder}/original`)
      }
    } catch (error) {
      console.error('api/img: R2 read failed, resizing from Storage', src, error)
    }
  }

  if (!original) {
    const upstream = await fetch(src, { cache: 'no-store' })
    if (!upstream.ok) return notFound(upstream.status === 404 ? 404 : 502)
    if (Number(upstream.headers.get('content-length') ?? 0) > MAX_FETCH_BYTES) {
      return Response.redirect(src, 302)
    }
    original = Buffer.from(await upstream.arrayBuffer())
    if (store && folder) await save(store, `${folder}/original`, original, upstream.headers.get('content-type') ?? 'application/octet-stream')
  }

  try {
    const output = await sharp(original)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer()
    if (store && folder) await save(store, `${folder}/${width}.webp`, output, 'image/webp')
    return webp(output)
  } catch (error) {
    // Not something sharp can read: hand back the original.
    console.error('api/img: resize failed', src, error)
    return Response.redirect(src, 302)
  }
}

function webp(body: Buffer) {
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': CACHE } })
}

function notFound(status: 404 | 502) {
  return new Response('Not found', { status, headers: { 'Cache-Control': 'public, max-age=60' } })
}

// A failed write only means the next miss does the work again.
async function save(store: ImageStore, key: string, body: Buffer, contentType: string) {
  try {
    await store.put(key, body, contentType)
  } catch (error) {
    console.error('api/img: R2 write failed', key, error)
  }
}
