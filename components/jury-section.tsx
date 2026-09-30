import { Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'

export async function JurySection() {
  const { m } = await getI18n()
  return (
    <section className="bg-grain border-t-2 border-ink/10 bg-collage-blue py-14 text-primary-foreground sm:py-18">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <Sparkles className="mx-auto size-8 text-collage-yellow" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-4 text-sm font-bold tracking-[0.25em] text-collage-yellow uppercase">
            {m.jury.eyebrow}
          </p>
          <h2 className="font-display mt-3 text-3xl leading-[1.05] tracking-tight uppercase sm:text-4xl">
            {m.jury.title1}
            <span className="block text-collage-yellow">{m.jury.title2}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-primary-foreground/75">
            {m.jury.body}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
