import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/lib/image-widths.mjs'
import { MAX_FETCH_BYTES } from '@/lib/onboarding-image'
import { imageStore, imageStorePrefix, imageStoreRoot, isVersionedSource, type ImageStore } from '@/lib/r2'

// Resizes a public Storage image for lib/image-loader.ts. Vercel's own image
// optimization returned 402 once its allowance ran out, so this does the
// same with sharp: the CDN caches each (url, width) pair, and the function
// only runs on a miss — which is often: the CDN cache is per region and
// starts empty after a deploy, so what a miss needs is kept in R2 (lib/r2.ts).
// Some storage paths are content-versioned when uploaded. They can safely be
// cached at Vercel's edge for a year, so repeat views do not invoke this
// Function at all. Mutable legacy paths retain a shorter cache lifetime.
const IMMUTABLE_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable'
const MUTABLE_CACHE = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
const IMAGE_FORMAT = 'webp'

function variantKey(folder: string, width: number) {
  // The folder identifies origin + exact Storage version. Include every
  // transform setting in the object name too, so future format/quality
  // changes cannot accidentally reuse an old derivative.
  return `${folder}/${width}w-q${IMAGE_QUALITY}.${IMAGE_FORMAT}`
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const src = params.get('url') ?? ''
  const width = Number(params.get('w'))

  // Exactly what lib/image-src.ts builds. Any extra param, or a query on the
  // photo URL, would be a fresh CDN cache key for the same image — a way to
  // make every request reach Storage and sharp.
  if ([...params.keys()].some((key) => key !== 'url' && key !== 'w') || params.getAll('url').length !== 1 || params.getAll('w').length !== 1) {
    return new Response('Bad params', { status: 400 })
  }

  // Only this project's public bucket — otherwise it's an open image proxy.
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !src.startsWith(prefix) || src.includes('..') || /[?#]/.test(src)) {
    return new Response('Bad url', { status: 400 })
  }
  if (!IMAGE_WIDTHS.includes(width)) return new Response('Bad width', { status: 400 })

  // With R2 configured, Storage is asked for the photo itself once per
  // version; every later miss — another width, another CDN region, the cache
  // emptied by a deploy — is answered from R2. The HEAD (no body) is how an
  // overwritten photo is noticed. If Storage is temporarily unavailable
  // (including a quota 402), use the last R2 version instead of turning a
  // cache miss into a broken image.
  const store = imageStore()
  const immutable = isVersionedSource(src)
  let folder: string | null = null
  let original: Buffer | null = null
  if (store) {
    try {
      // A versioned URL cannot be overwritten. Check the R2 marker first so
      // an R2 hit avoids both the Supabase version HEAD and sharp entirely.
      if (immutable) {
        folder = await cachedFolder(store, src)
        if (folder) {
          const stored = await store.get(variantKey(folder, width))
          if (stored) return webp(stored, true, request)
        }
      }

      const head = await fetch(src, { method: 'HEAD', cache: 'no-store' })
      if (head.status === 404) return notFound(404)
      const version = head.headers.get('etag') ?? head.headers.get('last-modified')
      if (head.ok && version) folder = imageStorePrefix(src, version)
      if (!folder) {
        folder = await cachedFolder(store, src)
        console.warn('api/img: Storage version unavailable, using R2 fallback when present', src, head.status)
      }
      if (folder) {
        const stored = await store.get(variantKey(folder, width))
        if (stored) return webp(stored, immutable, request)
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
    if (store && folder) {
      await save(store, `${folder}/original`, original, upstream.headers.get('content-type') ?? 'application/octet-stream')
      await save(store, `${imageStoreRoot(src)}/current`, Buffer.from(folder), 'text/plain')
    }
  }

  try {
    const output = await sharp(original)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer()
    if (store && folder) await save(store, variantKey(folder, width), output, 'image/webp')
    return webp(output, immutable, request)
  } catch (error) {
    // Not something sharp can read: hand back the original.
    console.error('api/img: resize failed', src, error)
    return Response.redirect(src, 302)
  }
}

function webp(body: Buffer, immutable: boolean, request: Request) {
  const etag = `"${createHash('sha256').update(body).digest('hex')}"`
  const headers = {
    'Content-Type': `image/${IMAGE_FORMAT}`,
    'Cache-Control': immutable ? IMMUTABLE_CACHE : MUTABLE_CACHE,
    ETag: etag,
  }
  // Mutable photos expire in the browser. Validate their exact derivative
  // so an unchanged photo can be reused without transferring its body again.
  const matches = request.headers.get('if-none-match')?.split(',').some((value) => {
    const candidate = value.trim().replace(/^W\//, '')
    return candidate === '*' || candidate === etag
  })
  if (matches) return new Response(null, { status: 304, headers })
  return new Response(new Uint8Array(body), {
    headers,
  })
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

async function cachedFolder(store: ImageStore, src: string): Promise<string | null> {
  const current = await store.get(`${imageStoreRoot(src)}/current`)
  if (current) {
    const folder = current.toString('utf8')
    // Also accept folders written by the initial R2 implementation so an
    // upgrade does not discard an already-warm cache.
    if (/^img\/[a-f0-9]{64}\/[a-zA-Z0-9]+$/.test(folder)) return folder
  }
  return store.findLatestFolder?.(imageStoreRoot(src)) ?? null
}
