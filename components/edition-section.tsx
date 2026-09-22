import Link from 'next/link'
import { Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { getSubmissionsCount } from '@/lib/submissions'
import { site } from '@/lib/site'

export async function EditionSection() {
  const submissionsCount = await getSubmissionsCount()
  const hasSubmissions = submissionsCount > 0

  return (
    <section id="primera-edicion" className="relative overflow-hidden border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-1 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            El Mundial ya está pasando
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="mt-6 text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase sm:text-sm">
            Edición 01 · 2026
          </p>
        </FadeIn>

        <FadeIn delay={150}>
          <h2 className="font-display mt-2 flex flex-col items-center gap-2 text-ink">
            {hasSubmissions ? (
              <>
                <span className="flex items-center gap-3 text-7xl leading-none tracking-tight text-collage-red sm:text-8xl">
                  <Images className="h-10 w-10 sm:h-14 sm:w-14" strokeWidth={2.5} aria-hidden="true" />
                  {submissionsCount.toLocaleString('es-AR')}
                </span>
                <span className="text-sm font-bold tracking-[0.2em] uppercase sm:text-base">
                  {submissionsCount === 1 ? 'Obra recibida' : 'Obras recibidas'}
                </span>
              </>
            ) : (
              <span className="text-3xl uppercase tracking-tight sm:text-4xl">La convocatoria está abierta</span>
            )}
          </h2>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="font-display mx-auto mt-6 max-w-xl text-2xl uppercase text-ink sm:text-3xl">
            El mundo se está recortando y pegando acá.
          </p>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Cada obra suma una mirada. La próxima puede ser la tuya.
          </p>
        </FadeIn>

        <FadeIn delay={400}>
          <div className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <a href={`mailto:${site.email}`}>Sumá tu obra al Mundial</a>
            </Button>
            <Link href="#participantes" className="text-sm font-semibold text-collage-blue underline underline-offset-4">
              Descubrí las obras participantes →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
