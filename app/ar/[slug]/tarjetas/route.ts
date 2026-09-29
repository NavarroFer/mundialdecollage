import { printCardsPdf, type CardFormat } from '@/lib/ar/print-cards'
import { countryCodeToName, getFinalistBySlug } from '@/lib/finalists'
import { isLocale, localeForCountry, DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// A4 PDF with four AR cards to cut out (see lib/ar/print-cards.tsx).
// ?formato=obra (default) prints the obra itself; ?formato=tarjeta prints the
// Mundial logo card the obra floats over.
//
// The cards speak the artist's language (they hand them out where they live);
// ?idioma= picks another (not ?lang=: proxy.ts takes that one to switch
// the whole site's language).
//
// Signed-in people only, linked from the admin obra viewer for now; artists
// will get them from their profile, and later the subscription (ROADMAP.md).
// The AR page itself stays public, since anyone scanning a card has to see
// it; without a session this just sends them there.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const user = isSupabaseConfigured ? (await (await createClient()).auth.getUser()).data.user : null
  if (!user) return Response.redirect(new URL(`/ar/${encodeURIComponent(slug)}`, url.origin), 303)
  const format: CardFormat = url.searchParams.get('formato') === 'tarjeta' ? 'tarjeta' : 'obra'
  const finalist = await getFinalistBySlug(slug)
  if (!finalist) return new Response(null, { status: 404 })
  const lang = url.searchParams.get('idioma')
  const locale = isLocale(lang) ? lang : (localeForCountry(finalist.countryCode) ?? DEFAULT_LOCALE)
  const m = MESSAGES[locale]

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
    text: m.ar.card,
  })
  return new Response(pdf as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="tarjetas-ar-${format}-${locale}-${finalist.slug}.pdf"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
