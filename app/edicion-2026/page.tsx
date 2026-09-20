import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Images } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { FadeIn } from '@/components/fade-in'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, getFinalists } from '@/lib/finalists'
import { getSubmissionsCount } from '@/lib/submissions'

export const metadata = {
  title: 'Primera Edición 2026 | Mundial de Collage',
  description: 'Los finalistas y las obras recibidas en la primera edición del Mundial Internacional de Collage.',
}

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default async function Edicion2026Page() {
  const [finalists, submissionsCount] = await Promise.all([getFinalists(), getSubmissionsCount()])

  return (
    <>
      <SiteHeader />
      <main className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <FadeIn>
            <span className="torn-strip mt-8 inline-block -rotate-1 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
              Primera edición
            </span>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="font-display mt-6 text-4xl leading-[1.05] tracking-tight text-ink uppercase sm:text-6xl">
              Edición 01 · 2026
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="mt-4 flex items-center gap-2 text-sm font-bold tracking-[0.15em] text-collage-red uppercase">
              <Images className="h-4 w-4" strokeWidth={2.5} />
              {submissionsCount > 0
                ? `${submissionsCount} ${submissionsCount === 1 ? 'obra recibida' : 'obras recibidas'}`
                : 'La convocatoria está abierta — todavía no llegaron obras'}
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            {finalists.length > 0 ? (
              <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {finalists.map((finalist) => (
                  <li key={finalist.slug}>
                    <Link
                      href={`/obras/${finalist.slug}`}
                      className="group block overflow-hidden rounded-2xl border-2 border-ink/10 bg-card transition-transform hover:-translate-y-1"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        <Image
                          src={finalist.imageUrl}
                          alt={`${finalist.artworkTitle}, de ${finalist.name}`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-5">
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          <span aria-hidden>{countryCodeToFlag(finalist.countryCode)}</span>
                          {finalist.name}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {countryCodeToName(finalist.countryCode)}
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink/80 italic">{finalist.artworkTitle}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-12 text-center text-muted-foreground">
                Los finalistas se anuncian acá apenas cierre la convocatoria.
              </p>
            )}
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  )
}
