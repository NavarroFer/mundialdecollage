import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'

const steps = [
  {
    number: '01',
    color: 'bg-collage-blue',
    title: 'Creá tu collage',
    description: 'Tiene que ser una obra original y propia, en la técnica que quieras.',
  },
  {
    number: '02',
    color: 'bg-collage-red',
    title: 'Elegí cómo enviarla',
    description: 'Podés cargar la imagen directamente en la web o mandarla por email.',
  },
  {
    number: '03',
    color: 'bg-collage-yellow',
    title: 'Completá tus datos',
    description: 'Sumá tu nombre, país y el título de la obra. Si elegís email, incluí todo en el mismo mensaje.',
  },
]

export function HowToSection() {
  return (
    <section id="como-participar" className="border-t-2 border-ink/10 bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            Cómo participar
          </p>
          <h2 className="font-display mt-3 text-center text-3xl tracking-tight uppercase sm:text-4xl">
            Mandá tu obra en 3 pasos
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 120}>
              <div className="relative h-full rounded-2xl border-2 border-ink/10 bg-background p-7">
                <span
                  className={`torn-top absolute -top-4 left-6 inline-block px-3 py-1 text-xs font-black text-primary-foreground ${step.color} ${i % 2 === 0 ? 'rotate-[-3deg]' : 'rotate-2'}`}
                >
                  {step.number}
                </span>
                <h3 className="mt-6 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={400}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <Link href="/onboarding">Registrarme y cargar mi obra</Link>
            </Button>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
            >
              Enviar mi obra por email
            </a>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            ¿Para qué pedimos &quot;Iniciar sesión con Google&quot;? La usamos para
            identificarte cuando subís tu obra al Mundial Internacional de Collage o
            te anotás al taller, así podés hacer seguimiento de tu participación sin
            crear una cuenta nueva.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
