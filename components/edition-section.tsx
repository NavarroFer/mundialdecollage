import Link from 'next/link'
import { Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { getSubmissionsCount } from '@/lib/submissions'

export async function EditionSection() {
  const submissionsCount = await getSubmissionsCount()

  return (
    <section id="primera-edicion" className="relative overflow-hidden border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-1 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            Primera edición
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <h2 className="font-display mt-6 text-4xl leading-[1.05] tracking-tight text-ink uppercase sm:text-6xl">
            Edición 01 · 2026
          </h2>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-4 flex items-center justify-center gap-2 text-sm font-bold tracking-[0.15em] text-collage-red uppercase">
            <Images className="h-4 w-4" strokeWidth={2.5} />
            {submissionsCount > 0
              ? `${submissionsCount} ${submissionsCount === 1 ? 'obra recibida' : 'obras recibidas'}`
              : 'La convocatoria está abierta — todavía no llegaron obras'}
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            {submissionsCount > 0
              ? 'Los finalistas y todas las obras de esta edición, en un solo lugar.'
              : 'Acá va a vivir el archivo completo del Mundial: los finalistas y sus obras, apenas cierre la convocatoria.'}
          </p>
        </FadeIn>

        <FadeIn delay={400}>
          <Link href="/edicion-2026" className="mt-8 inline-block">
            <Button size="lg">Ver la Primera Edición</Button>
          </Link>
        </FadeIn>
      </div>
    </section>
  )
}
