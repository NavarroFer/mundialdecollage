import { notFound } from 'next/navigation'
import { artworkOgImage, OG_SIZE } from '@/lib/artwork-share-image'
import { getPublishedFinalistBySlug } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'
import { site } from '@/lib/site'

export const alt = site.name
export const size = OG_SIZE
export const contentType = 'image/png'

// The preview a shared /obras link unfolds into: the obra itself, who made
// it and the invitation to take part. Published obras only.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [finalist, { locale, m }] = await Promise.all([getPublishedFinalistBySlug(slug), getI18n()])
  if (!finalist) notFound()
  return artworkOgImage({ finalist, locale, m })
}
