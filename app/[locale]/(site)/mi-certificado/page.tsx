import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Award, Download, Instagram, PencilLine, Smartphone } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Button } from '@/components/ui/button'
import { TrackedAnchor, TrackView } from '@/components/track'
import { getCallState } from '@/lib/call-state'
import { certificateSecret, isValidCertificateToken } from '@/lib/certificate-token'
import { getCertificateFinalistBySlug, getFinalistBySlug, getRenamedArtworkSlug, type Finalist } from '@/lib/finalists'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import type { Messages } from '@/lib/i18n/messages'
import { getMyCertificateSlug, MY_CERTIFICATE_PATH } from '@/lib/my-certificate'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.certificate.pageTitle, robots: { index: false } }
}

// The artist's participation certificate: a look at the diploma and the
// buttons to download it and the Instagram image (both drawn once and kept,
// lib/certificate-cache.ts). Opened signed in — the header, the account menu
// and the home link here — or from a mail with ?obra=<slug>&t=<token>
// (lib/certificate-token.ts): many Registro artists never sign in. Private,
// so it is not one of lib/static-pages.ts.
export default async function MyCertificatePage({ searchParams }: { searchParams: Promise<{ obra?: string; t?: string }> }) {
  const { m } = await getI18n()
  const t = m.certificate
  const { obra, t: token } = await searchParams
  const { open } = await getCallState()

  // From a mail: the token was signed for the slug of its day, and the
  // certificate route checks it against that same slug.
  let finalist: Finalist | undefined
  let linkSlug: string | null = null
  const fromMail = Boolean(!open && obra && token && isValidCertificateToken(obra, token, certificateSecret()))
  if (fromMail && obra) {
    finalist = await getCertificateFinalistBySlug((await getRenamedArtworkSlug(obra)) ?? obra)
    linkSlug = obra
  }

  const user = isSupabaseConfigured && !finalist ? await getCurrentUser() : null
  if (!finalist && user) {
    const slug = await getMyCertificateSlug()
    finalist = slug ? await getFinalistBySlug(slug) : undefined
    linkSlug = finalist?.slug ?? null
  }

  return (
    <>
      <SiteHeader />
      <main className="bg-grain relative min-h-[70vh] overflow-hidden py-10 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 -left-16 h-40 w-56 -rotate-6 bg-collage-blue sm:h-56 sm:w-80" style={{ clipPath: 'polygon(3% 6%, 94% 0, 100% 22%, 93% 52%, 100% 91%, 68% 100%, 38% 92%, 0 100%)' }} />
          <div className="absolute top-24 -right-10 h-20 w-20 rounded-full bg-collage-yellow sm:h-28 sm:w-28" />
        </div>
        <section className="relative mx-auto max-w-5xl px-4 sm:px-8">
          {finalist && linkSlug ? (
            <Certificate m={m} finalist={finalist} linkSlug={linkSlug} token={fromMail ? token ?? null : null} />
          ) : (
            <Unavailable m={m} signedIn={Boolean(user)} callOpen={open} />
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}

function Certificate({ m, finalist, linkSlug, token }: { m: Messages; finalist: Finalist; linkSlug: string; token: string | null }) {
  const t = m.certificate
  const base = `/obras/${encodeURIComponent(linkSlug)}/certificado`
  const signed = token ? `&t=${encodeURIComponent(token)}` : ''
  const href = (query: string) => `${base}?${query}${signed}`
  const firstName = finalist.name.trim().split(/\s+/)[0]

  return (
    <>
      <TrackView event="certificate_view" />
      {token && <TrackView event="certificate_view_mail" />}
      <div className="text-center sm:text-left">
        <span className="torn-strip inline-flex -rotate-2 items-center gap-1.5 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
          <Award className="h-4 w-4" aria-hidden="true" />
          {t.readyBadge}
        </span>
        <h1 className="font-display mt-5 text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.pageTitle}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground sm:mx-0">{fmt(t.pageLead, { name: firstName })}</p>
      </div>

      <figure className="mt-8 sm:mt-10">
        <div className="relative mx-auto aspect-[297/210] w-full -rotate-[0.6deg] overflow-hidden rounded-sm bg-paper shadow-[0_20px_50px_color-mix(in_srgb,var(--ink)_22%,transparent)] ring-1 ring-ink/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn on the server and kept in R2; next/image would resize it again */}
          <img src={href('formato=vista')} alt={fmt(t.previewAlt, { name: finalist.name })} width={1600} height={1131} className="h-full w-full object-cover" />
        </div>
      </figure>

      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="h-auto min-h-14 gap-2 px-8 text-base">
          <TrackedAnchor href={href('formato=pdf')} event="certificate_download_pdf" download>
            <Download className="h-5 w-5" aria-hidden="true" />
            {t.downloadPdf}
          </TrackedAnchor>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-auto min-h-14 gap-2 px-6 text-base">
          <TrackedAnchor href={href('formato=imagen')} event="certificate_download_image" download>
            <Instagram className="h-5 w-5" aria-hidden="true" />
            {t.downloadImage}
          </TrackedAnchor>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-auto min-h-14 gap-2 px-6 text-base">
          <TrackedAnchor href={href('formato=historia')} event="certificate_download_story" download>
            <Smartphone className="h-5 w-5" aria-hidden="true" />
            {t.downloadStory}
          </TrackedAnchor>
        </Button>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
          <h2 className="font-display text-2xl tracking-tight text-ink uppercase">{t.shareTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.shareBody}</p>
          <div className="mt-4 flex items-end gap-4">
            {[
              { query: 'formato=imagen', label: t.downloadImage, event: 'certificate_download_image' as const, ratio: 'aspect-[4/5] w-28 sm:w-32', size: [1080, 1350], tilt: 'rotate-2' },
              { query: 'formato=historia', label: t.downloadStory, event: 'certificate_download_story' as const, ratio: 'aspect-[9/16] w-24 sm:w-28', size: [1080, 1920], tilt: '-rotate-2' },
            ].map((image) => (
              <TrackedAnchor key={image.query} href={href(image.query)} event={image.event} download className="group flex flex-col items-center gap-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- drawn on the server and kept in R2 */}
                <img src={href(`${image.query}&ver=1`)} alt="" width={image.size[0]} height={image.size[1]} loading="lazy" className={`${image.ratio} ${image.tilt} rounded-sm object-cover shadow-md ring-1 ring-ink/10 transition-transform group-hover:rotate-0`} />
                <span className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-collage-blue underline underline-offset-4">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {image.label}
                </span>
              </TrackedAnchor>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-collage-yellow/40 bg-collage-yellow/10 p-5 sm:p-6">
          <h2 className="font-display text-2xl tracking-tight text-ink uppercase">{t.checkTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.checkBody}</p>
          <div className="mt-3 flex flex-wrap gap-x-5">
            <Link href="/onboarding" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-collage-blue underline underline-offset-4">
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              {t.checkCta}
            </Link>
            <Link href={`/obras/${finalist.slug}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-collage-blue underline underline-offset-4">
              {m.common.viewMyArtwork}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

// No certificate to show: signed out (and no valid mail link), the call
// still open, or an account without an obra that takes part.
function Unavailable({ m, signedIn, callOpen }: { m: Messages; signedIn: boolean; callOpen: boolean }) {
  const t = m.certificate
  const [title, body] = !signedIn ? [t.signInTitle, t.signInBody] : callOpen ? [t.notYetTitle, t.notYetBody] : [t.noArtworkTitle, t.noArtworkBody]
  return (
    <div className="mx-auto max-w-xl rounded-2xl border-2 border-ink/10 bg-card p-8 text-center">
      <Award className="mx-auto h-12 w-12 text-collage-red" aria-hidden="true" />
      <h1 className="font-display mt-5 text-3xl tracking-tight text-ink uppercase sm:text-4xl">{title}</h1>
      <p className="mt-4 text-muted-foreground">{body}</p>
      {!signedIn ? (
        <>
          <div className="mt-7 flex justify-center">
            <GoogleSignInButton next={MY_CERTIFICATE_PATH} />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t.signInMailHint}</p>
        </>
      ) : (
        <Button asChild variant="outline" className="mt-7">
          <Link href="/">{m.confirmation.backToMundial}</Link>
        </Button>
      )}
    </div>
  )
}
