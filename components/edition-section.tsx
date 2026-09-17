import Link from 'next/link'
import { Images } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, finalists } from '@/lib/finalists'
import { submissionsCount } from '@/lib/submissions'

export function EditionSection() {
  return (
    <section id="primera-edicion" className="relative overflow-hidden border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-1 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            Primera edición
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <h2 className="font-display mt-6 text-4xl leading-[1.05] tracking-tight text-ink uppercase sm:text-6xl">
            Mundial de Collage 2026
          </h2>
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
                    <div className="aspect-square w-full overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={finalist.imageUrl}
                        alt={`${finalist.artworkTitle}, de ${finalist.name}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
    </section>
  )
}
