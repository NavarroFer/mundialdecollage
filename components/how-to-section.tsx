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
    title: 'Enviá una imagen',
    description: (
      <>
        Mandá una foto de tu obra a{' '}
        <a href={`mailto:${site.email}`} className="font-semibold text-ink underline underline-offset-4">
          {site.email}
        </a>
        .
      </>
    ),
  },
  {
    number: '03',
    color: 'bg-collage-yellow',
    title: 'Sumá los datos',
    description: 'Incluí tu nombre, país y el título de la obra en el mismo mail.',
  },
]

export function HowToSection() {
  return (
    <section className="border-t-2 border-ink/10 bg-card py-20 sm:py-28">
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
      </div>
    </section>
  )
}
