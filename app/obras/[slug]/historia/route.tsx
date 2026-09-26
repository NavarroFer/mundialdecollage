import { artworkStoryImage } from '@/lib/artwork-share-image'
import { getFinalistBySlug } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'

// A 1080x1920 picture of the obra for Instagram stories. Session-aware like
// the obra page, so an artist can post theirs while it's still under review;
// hence private caching.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [finalist, { locale, m }] = await Promise.all([getFinalistBySlug(slug), getI18n()])
  if (!finalist) return new Response(null, { status: 404 })

  const image = await artworkStoryImage({ finalist, locale, m })
  const headers = new Headers(image.headers)
  headers.set('cache-control', 'private, max-age=3600')
  headers.set('content-disposition', `attachment; filename="mundial-de-collage-${slug}.png"`)
  return new Response(image.body, { status: image.status, headers })
}
