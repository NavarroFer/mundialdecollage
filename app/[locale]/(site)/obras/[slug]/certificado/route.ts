import { certificateFile, type CertificateFile } from '@/lib/certificate-cache'
import { isValidCertificateToken, certificateSecret } from '@/lib/certificate-token'
import { getCertificateFinalistBySlug, getFinalistBySlug, getRenamedArtworkSlug, type Finalist } from '@/lib/finalists'
import { getCallState } from '@/lib/call-state'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getSiteUrl, site } from '@/lib/site'
import { isLocale, localeForCountry, DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// The participation certificate of an obra (lib/certificate.tsx):
// ?formato=pdf (default) is the A4 diploma to print, ?formato=imagen the
// Instagram post, ?formato=historia the Instagram story and ?formato=vista a smaller picture of the diploma for
// /mi-certificado, which also passes ?ver=1 to show the image instead of
// downloading it. Each is drawn once and kept (lib/certificate-cache.ts). Once the call is closed (/admin/convocatoria) the obra's
// own artist can download it, signed in or through the signed ?t= link the
// certificate mail carries (lib/certificate-mail.ts) — many Registro
// artists never sign in. Admins always can, to preview it.
//
// In the artist's language like the AR cards; ?idioma= picks another (not
// ?lang=: proxy.ts takes that one to switch the whole site's language).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const { open, closedAt } = await getCallState()

  let finalist: Finalist | undefined
  const token = url.searchParams.get('t')
  // A certificate mail signed the slug of its day: a shortened one is still
  // checked as it was signed, and the obra is read under its slug now.
  const current = (await getRenamedArtworkSlug(slug)) ?? slug
  if (token) {
    if (open || !isValidCertificateToken(slug, token, certificateSecret())) return new Response(null, { status: 404 })
    finalist = await getCertificateFinalistBySlug(current)
  } else {
    const user = isSupabaseConfigured ? (await (await createClient()).auth.getUser()).data.user : null
    if (!user) return new Response(null, { status: 404 })
    finalist = await getFinalistBySlug(current)
    const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')
    const isOwner = finalist?.profileId === user.id
    if (!isAdmin && !(isOwner && !open)) return new Response(null, { status: 404 })
  }
  if (!finalist) return new Response(null, { status: 404 })

  const lang = url.searchParams.get('idioma')
  const locale = isLocale(lang) ? lang : (localeForCountry(finalist.countryCode) ?? DEFAULT_LOCALE)
  const input = {
    finalist,
    locale,
    m: MESSAGES[locale],
    verifyUrl: new URL(`/obras/${finalist.slug}`, getSiteUrl()).toString(),
    // Dated the day the call closed; an admin preview before that shows the planned date.
    issuedISO: closedAt ?? site.certificates.issuedISO,
  }
  const name = `certificado-mundial-de-collage-${finalist.slug}`

  const format = url.searchParams.get('formato')
  const file: CertificateFile = format === 'imagen' ? 'post' : format === 'historia' ? 'story' : format === 'vista' ? 'preview' : 'pdf'
  const { body, contentType } = await certificateFile(file, input)
  const extension = file === 'pdf' ? 'pdf' : file === 'preview' ? 'jpg' : 'png'
  const inline = file === 'preview' || url.searchParams.get('ver') === '1'
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': contentType,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${file === 'story' ? `${name}-historia` : name}.${extension}"`,
      'cache-control': 'private, max-age=3600',
    },
  })
}
