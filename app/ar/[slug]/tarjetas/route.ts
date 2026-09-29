import { printCardsPdf, type CardFormat } from '@/lib/ar/print-cards'
import { countryCodeToName, getFinalistBySlug } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'

// A4 PDF with four AR cards to cut out (see lib/ar/print-cards.tsx).
// ?formato=obra (default) prints the obra itself; ?formato=tarjeta prints the
// Mundial logo card the obra floats over.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const format: CardFormat = url.searchParams.get('formato') === 'tarjeta' ? 'tarjeta' : 'obra'
  const [finalist, { locale, m }] = await Promise.all([getFinalistBySlug(slug), getI18n()])
  if (!finalist) return new Response(null, { status: 404 })

  // The QR points at whichever host served the PDF, so a preview's cards
  // open that preview.
  const arUrl = new URL(`/ar/${finalist.slug}`, url.origin)
  if (format === 'tarjeta') arUrl.searchParams.set('modo', 'tarjeta')

  const pdf = await printCardsPdf({
    format,
    imageUrl: finalist.imageUrl,
    title: finalist.artworkTitle ?? m.common.untitled,
    artist: `${finalist.name} · ${countryCodeToName(finalist.countryCode, locale)}`,
    arUrl: arUrl.toString(),
  })
  return new Response(pdf as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="tarjetas-ar-${format}-${finalist.slug}.pdf"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
