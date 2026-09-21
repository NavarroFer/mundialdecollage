import Link from 'next/link'
import { FadeIn } from '@/components/fade-in'
import { ObrasCollage } from '@/components/obras-collage'
import { countryCodeToFlag, getParticipants } from '@/lib/participants'
import { getFinalists } from '@/lib/finalists'

// Teaser only — capped so the homepage doesn't grow an unbounded pill wall
// as submissions come in. /participantes has search/filter for the full list.
const HOMEPAGE_LIMIT = 40

// Keep the collage compact; the full participant list is linked below.
const COLLAGE_LIMIT = 10

export async function ParticipantsSection() {
  const [participants, finalists] = await Promise.all([
    getParticipants({ limit: HOMEPAGE_LIMIT }),
    getFinalists(),
  ])
  const collageFinalists = finalists.slice(0, COLLAGE_LIMIT)

  return (
    <section id="participantes" className="border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            Participantes
          </p>
          <h2 className="font-display mt-3 text-center text-3xl tracking-tight uppercase sm:text-4xl">
            Ya se están sumando
          </h2>
        </FadeIn>
      </div>

      {collageFinalists.length > 0 && (
        <FadeIn delay={100}>
          <ObrasCollage finalists={collageFinalists} />
        </FadeIn>
      )}

      <div className="mx-auto mt-12 max-w-4xl px-5 sm:px-8">
        <FadeIn delay={150}>
          {participants.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-3">
              {participants.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-2 rounded-full border-2 border-ink/10 bg-card px-4 py-2 text-sm font-medium text-ink"
                >
                  <span aria-hidden>{countryCodeToFlag(p.countryCode)}</span>
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-muted-foreground">
              Todavía no hay obras confirmadas — la tuya puede ser la primera acá.
            </p>
          )}
        </FadeIn>

        <FadeIn delay={250}>
          <div className="mt-8 text-center">
            <Link
              href="/participantes"
              className="text-sm font-semibold text-collage-blue underline underline-offset-4 hover:text-collage-blue/80"
            >
              Ver todos los participantes →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
