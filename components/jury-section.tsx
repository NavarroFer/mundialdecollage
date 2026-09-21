import { Globe2, Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'

export function JurySection() {
  return (
    <section className="bg-grain relative overflow-hidden border-t-2 border-ink/10 bg-collage-blue py-20 text-primary-foreground sm:py-28">
      <Globe2
        className="pointer-events-none absolute -right-10 -bottom-16 h-56 w-56 text-primary-foreground/10 sm:h-72 sm:w-72"
        strokeWidth={1}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 md:grid-cols-2 md:items-center">
        <FadeIn direction="right">
          <p className="text-sm font-bold tracking-[0.25em] text-collage-yellow uppercase">
            Jurado internacional
          </p>
          <h2 className="font-display mt-3 text-3xl leading-[1.05] tracking-tight uppercase sm:text-4xl">
            Artistas de renombre
            <br />
            forman parte del jurado
          </h2>
          <p className="mt-5 max-w-md text-primary-foreground/75">
            Un jurado con trayectoria internacional va a evaluar cada obra recibida.
            Muy pronto anunciamos quiénes lo integran.
          </p>
        </FadeIn>

        <FadeIn direction="left" delay={150}>
          <div className="ml-auto w-full max-w-sm rounded-2xl border-2 border-primary-foreground/20 bg-primary-foreground/10 p-8 text-center backdrop-blur-sm">
            <Sparkles className="mx-auto h-8 w-8 text-collage-yellow" strokeWidth={1.5} />
            <p className="font-display mt-4 text-2xl tracking-wide uppercase">Premios</p>
            <div className="mt-5 space-y-4 text-left">
              <div>
                <p className="font-display text-lg tracking-wide text-collage-yellow uppercase">
                  Gran Muestra Online
                </p>
                <p className="mt-1 text-sm text-primary-foreground/70">
                  Todas las obras seleccionadas por el jurado forman parte de la muestra oficial.
                </p>
              </div>
              <div>
                <p className="font-display text-lg tracking-wide text-collage-yellow uppercase">
                  Revista — 1ª edición de Collage
                </p>
                <p className="mt-1 text-sm text-primary-foreground/70">
                  Las mejores 30 obras se publican en la primera edición de la revista del Mundial
                  de Collage.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
