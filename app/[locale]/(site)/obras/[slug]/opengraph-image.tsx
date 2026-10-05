import { notFound } from 'next/navigation'
import { artworkOgImage, OG_SIZE } from '@/lib/artwork-share-image'
import { getPublishedFinalistBySlug } from '@/lib/finalists'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'
import { site } from '@/lib/site'

export const alt = site.name
export const size = OG_SIZE
export const contentType = 'image/png'
// The language comes from the URL, not the request, so the CDN keeps each
// one: drawn once a day at most, and only from R2 after the first time.
export const revalidate = 86400

// Drawn the first time each one is asked for, then kept.
export function generateStaticParams() {
  return []
}

// The preview a shared /obras link unfolds into: the obra itself, who made
// it and the invitation to take part. Published obras only.
export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: param, slug } = await params
  const locale = isLocale(param) ? param : DEFAULT_LOCALE
  const finalist = await getPublishedFinalistBySlug(slug)
  if (!finalist) notFound()
  return artworkOgImage({ finalist, locale, m: MESSAGES[locale] })
}
