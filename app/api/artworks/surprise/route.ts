import { randomInt } from 'node:crypto'
import { getFinalists } from '@/lib/finalists'

// Pick on each click, rather than pre-rendering a random destination into
// the cached home. Only works visible to the public are eligible.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const excluded = url.searchParams.get('exclude')
  const artworks = (await getFinalists()).filter((artwork) => artwork.slug !== excluded)
  const path = artworks.length
    ? `/obras/${encodeURIComponent(artworks[randomInt(artworks.length)].slug)}`
    : '/#participantes'

  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(path, url.origin).href,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
