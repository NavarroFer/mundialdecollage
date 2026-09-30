import Link from 'next/link'
import { Compass, Scissors, Send } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'
import { MAP_SECTION_ID } from '@/lib/map-country-link'

const stamps = [
  { key: 'first', href: '/onboarding', Icon: Send, tone: 'bg-collage-red text-paper -rotate-3' },
  { key: 'gallery', href: '/galeria-3d', Icon: Scissors, tone: 'bg-collage-yellow text-ink rotate-2' },
  { key: 'world', href: `#${MAP_SECTION_ID}`, Icon: Compass, tone: 'bg-collage-blue text-paper -rotate-1' },
] as const

export async function StampAlbum() {
  const { m } = await getI18n()
  const copy = {
    first: m.stamps.first,
    gallery: m.stamps.gallery,
    world: m.stamps.world,
  }

  return (
    <section className="border-t-2 border-ink/10 bg-paper py-14 sm:py-18">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-red uppercase">{m.stamps.eyebrow}</p>
          <h2 className="font-display mt-3 text-center text-3xl tracking-tight uppercase sm:text-4xl">{m.stamps.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">{m.stamps.body}</p>
        </FadeIn>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {stamps.map(({ key, href, Icon, tone }, index) => (
            <FadeIn key={key} delay={100 + index * 100}>
              <Link
                href={href}
                className="group block rounded-sm border-2 border-ink bg-card p-3 shadow-[5px_5px_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:rotate-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue"
              >
                <div className={`relative flex aspect-[1.4] flex-col items-center justify-center overflow-hidden border-2 border-dashed border-current p-3 text-center ${tone}`}>
                  <Icon className="size-8 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12" strokeWidth={1.5} aria-hidden="true" />
                  <p className="font-display mt-2 text-xl tracking-wide uppercase">{copy[key].title}</p>
                  <p className="mt-1 text-xs font-semibold opacity-80">{copy[key].body}</p>
                  <span className="absolute -right-5 -bottom-5 size-14 rounded-full border-2 border-current opacity-25" />
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
