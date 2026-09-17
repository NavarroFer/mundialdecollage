import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'

export function CtaSection() {
  return (
    <section className="border-t-2 border-ink/10 bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block rotate-2 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            Ya está sucediendo
          </span>

          <h2 className="font-display mt-7 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
            Mandá tu obra.
            <br />
            Participá ahora.
          </h2>

          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            ¿Conocés a alguien que hace collage? Mandaselo ahora — la convocatoria
            está abierta hasta el {site.deadlineLabel}.
          </p>

          <a href={`mailto:${site.email}`} className="mt-9 inline-block">
            <Button size="lg" className="gap-2">
              <Mail className="h-5 w-5" />
              Enviar mi obra
            </Button>
          </a>
        </FadeIn>
      </div>
    </section>
  )
}
