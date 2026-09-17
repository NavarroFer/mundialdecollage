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
            <p className="font-display mt-4 text-2xl tracking-wide uppercase">
              Premios
              <br />
              por anunciar
            </p>
            <p className="mt-3 text-sm text-primary-foreground/70">
              Los premios se revelan durante la convocatoria. Estate atento.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
