import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getParticipants } from '@/lib/participants'
import { ParticipantsDirectory } from './participants-directory'

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default async function ParticipantesPage() {
  const participants = await getParticipants()

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <FadeIn>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <p className="mt-8 text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            Participantes
          </p>
          <h1 className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-4xl">
            Todos los participantes
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Buscá y filtrá a todas las personas que ya mandaron su obra al Mundial.
          </p>
        </FadeIn>

        {participants.length > 0 ? (
          <FadeIn delay={150}>
            <ParticipantsDirectory participants={participants} />
          </FadeIn>
        ) : (
          <FadeIn delay={150}>
            <p className="mt-12 text-center text-muted-foreground">
              Todavía no hay participantes confirmados. Apenas empiecen a llegar obras, los vas
              a poder buscar y filtrar acá.
            </p>
          </FadeIn>
        )}
      </div>
    </main>
  )
}
