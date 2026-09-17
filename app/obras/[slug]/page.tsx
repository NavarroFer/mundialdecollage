import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Globe, Instagram } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, finalists, getFinalistBySlug } from '@/lib/finalists'

// Static params come straight from the finalists array — zero pages today,
// and it fills in on its own once real finalists are added.
export function generateStaticParams() {
  return finalists.map((finalist) => ({ slug: finalist.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const finalist = getFinalistBySlug(slug)
  if (!finalist) return {}

  return {
    title: `${finalist.artworkTitle} — ${finalist.name} | Mundial de Collage`,
    description: `"${finalist.artworkTitle}", de ${finalist.name} (${countryCodeToName(finalist.countryCode)}) — Mundial Internacional de Collage.`,
  }
}

export default async function ObraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const finalist = getFinalistBySlug(slug)

  if (!finalist) notFound()

  return (
    <>
      <SiteHeader />
      <main className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Link
            href="/#primera-edicion"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la Primera Edición
          </Link>

          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={finalist.imageUrl}
              alt={`${finalist.artworkTitle}, de ${finalist.name}`}
              className="w-full object-cover"
            />
          </div>

          <div className="mt-8">
            <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
              {finalist.technique}
            </p>
            <h1 className="font-display mt-2 text-3xl tracking-tight text-ink uppercase sm:text-5xl">
              {finalist.artworkTitle}
            </h1>

            <p className="mt-5 flex items-center gap-2 text-lg font-semibold text-ink">
              <span aria-hidden>{countryCodeToFlag(finalist.countryCode)}</span>
              {finalist.name}
            </p>
            <p className="text-muted-foreground">{countryCodeToName(finalist.countryCode)}</p>

            {(finalist.instagram || finalist.website) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {finalist.instagram && (
                  <a
                    href={finalist.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Instagram className="h-4 w-4 text-collage-red" />
                    Instagram
                  </a>
                )}
                {finalist.website && (
                  <a
                    href={finalist.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Globe className="h-4 w-4 text-collage-blue" />
                    Sitio web
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
