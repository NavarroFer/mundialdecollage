import sharp from 'sharp'
import { IMAGE_QUALITY, IMAGE_WIDTHS } from '@/lib/image-widths.mjs'
import { MAX_FETCH_BYTES } from '@/lib/onboarding-image'

// Resizes a public Storage image for lib/image-loader.ts. Vercel's own image
// optimization returned 402 once its allowance ran out, so this does the
// same with sharp: the CDN caches each (url, width) pair, and the function
// only runs on a miss. A day of freshness, then stale-while-revalidate, since
// a few paths (legacy/<id>.jpg) are overwritten in place when re-synced.
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

  const upstream = await fetch(src, { cache: 'no-store' })
  if (!upstream.ok) {
    return new Response('Not found', { status: upstream.status === 404 ? 404 : 502, headers: { 'Cache-Control': 'public, max-age=60' } })
  }
  if (Number(upstream.headers.get('content-length') ?? 0) > MAX_FETCH_BYTES) {
    return Response.redirect(src, 302)
  }

  try {
    const output = await sharp(Buffer.from(await upstream.arrayBuffer()))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer()
    return new Response(new Uint8Array(output), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': CACHE },
    })
  } catch (error) {
    // Not something sharp can read: hand back the original.
    console.error('api/img: resize failed', src, error)
    return Response.redirect(src, 302)
  }
}
