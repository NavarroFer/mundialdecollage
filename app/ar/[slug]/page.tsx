import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArViewer } from '@/components/ar/ar-viewer'
import { BRAND_TARGET_PATH } from '@/lib/ar/targets'
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

export default async function ArPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ modo?: string }>
}) {
  const [{ slug }, { modo }] = await Promise.all([params, searchParams])
  const mode = modo === 'tarjeta' ? 'tarjeta' : 'obra'
  const [finalist, { locale, m }] = await Promise.all([getFinalistBySlug(slug), getI18n()])
  if (!finalist) notFound()

  return (
    <ArViewer
      slug={finalist.slug}
      mode={mode}
      targetUrl={mode === 'tarjeta' ? BRAND_TARGET_PATH : finalist.imageUrl}
      imageUrl={finalist.imageUrl}
      title={finalist.artworkTitle ?? m.common.untitled}
      name={finalist.name}
      country={countryCodeToName(finalist.countryCode, locale)}
      flag={countryCodeToFlag(finalist.countryCode)}
    />
  )
}
