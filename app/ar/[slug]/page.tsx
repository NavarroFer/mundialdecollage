import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArViewer } from '@/components/ar/ar-viewer'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, getFinalistBySlug } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'

// Prototype: reachable from the QR on a print, kept out of search results.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const finalist = await getFinalistBySlug(slug)
  return {
    title: finalist ? `${finalist.artworkTitle ?? finalist.name} en realidad aumentada | Mundial de Collage` : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function ArPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [finalist, { locale, m }] = await Promise.all([getFinalistBySlug(slug), getI18n()])
  if (!finalist) notFound()

  return (
    <ArViewer
      slug={finalist.slug}
      imageUrl={finalist.imageUrl}
      title={finalist.artworkTitle ?? m.common.untitled}
      name={finalist.name}
      country={countryCodeToName(finalist.countryCode, locale)}
      flag={countryCodeToFlag(finalist.countryCode)}
    />
  )
}
