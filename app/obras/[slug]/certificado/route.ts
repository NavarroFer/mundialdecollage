import { certificatePdf, certificatePostImage } from '@/lib/certificate'
import { getFinalistBySlug } from '@/lib/finalists'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site } from '@/lib/site'
import { isLocale, localeForCountry, DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// The participation certificate of an obra (lib/certificate.tsx):
// ?formato=pdf (default) is the A4 diploma to print, ?formato=imagen the
// Instagram post. Only the obra's own artist can download it, and only once
// site.certificates.enabled is on; admins always can, to preview it.
//
// In the artist's language like the AR cards; ?idioma= picks another (not
// ?lang=: proxy.ts takes that one to switch the whole site's language).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const user = isSupabaseConfigured ? (await (await createClient()).auth.getUser()).data.user : null
  if (!user) return new Response(null, { status: 404 })

  const finalist = await getFinalistBySlug(slug)
  if (!finalist) return new Response(null, { status: 404 })
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')
  const isOwner = finalist.profileId === user.id
  if (!isAdmin && !(site.certificates.enabled && isOwner)) return new Response(null, { status: 404 })

  const lang = url.searchParams.get('idioma')
  const locale = isLocale(lang) ? lang : (localeForCountry(finalist.countryCode) ?? DEFAULT_LOCALE)
  const input = { finalist, locale, m: MESSAGES[locale], verifyUrl: new URL(`/obras/${finalist.slug}`, url.origin).toString() }
  const name = `certificado-mundial-de-collage-${finalist.slug}`

  if (url.searchParams.get('formato') === 'imagen') {
    const image = await certificatePostImage(input)
    const headers = new Headers(image.headers)
    headers.set('cache-control', 'private, max-age=3600')
    headers.set('content-disposition', `attachment; filename="${name}.png"`)
    return new Response(image.body, { status: image.status, headers })
  }

  const pdf = await certificatePdf(input)
  return new Response(pdf as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${name}.pdf"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
