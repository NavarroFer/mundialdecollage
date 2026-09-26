import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink } from '@/components/track'
import { ObrasCollage } from '@/components/obras-collage'
import { InstagramIconLink } from '@/components/instagram-icon-link'
import { countryCodeToFlag, getParticipants } from '@/lib/participants'
import { getDailyExhibition } from '@/lib/gallery-artworks'
import { getI18n } from '@/lib/i18n/server'

// Teaser only — capped so the homepage doesn't grow an unbounded pill wall
// as submissions come in. /participantes has search/filter for the full list.
const HOMEPAGE_LIMIT = 40

export async function ParticipantsSection() {
  const [participants, collageFinalists, { m }] = await Promise.all([
    getParticipants({ limit: HOMEPAGE_LIMIT }),
    getDailyExhibition(),
    getI18n(),
  ])

  return (
    <section id="participantes" className="border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            {m.participants.eyebrow}
          </p>
          <h2 className="font-display mt-3 text-center text-3xl tracking-tight uppercase sm:text-4xl">
            {m.participants.title}
          </h2>
        </FadeIn>
      </div>

      {collageFinalists.length > 0 && (
        <FadeIn delay={100}>
          <ObrasCollage finalists={collageFinalists} />
        </FadeIn>
      )}

      <FadeIn delay={150}>
        <div className="mx-auto mt-8 max-w-xl px-5 text-center sm:px-8">
          <p className="mb-4 text-sm font-bold tracking-[0.15em] text-collage-red uppercase">
            {m.participants.playEyebrow}
          </p>
          <Button asChild size="lg" variant="primary" className="h-auto min-h-14 whitespace-normal py-4">
            <TrackedLink href="/galeria-3d" prefetch={false} event="gallery_click_home">
              <Gamepad2 className="size-5" aria-hidden="true" />
              {m.participants.playCta}
            </TrackedLink>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            {m.participants.playSub}
          </p>
        </div>
      </FadeIn>

      <div className="mx-auto mt-12 max-w-4xl px-5 sm:px-8">
        <FadeIn delay={150}>
          {participants.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-3">
              {/* Names can repeat (the same artist on two accounts), so the
                  key includes the position, like /participantes does. */}
              {participants.map((p, i) => (
                <li
                  key={`${p.name}-${p.countryCode}-${i}`}
                  className="flex items-center gap-2 rounded-full border-2 border-ink/10 bg-card px-4 py-2 text-sm font-medium text-ink"
                >
                  <span aria-hidden>{countryCodeToFlag(p.countryCode)}</span>
                  {p.name}
                  {p.instagram && <InstagramIconLink href={p.instagram} name={p.name} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-muted-foreground">
              {m.participants.empty}
            </p>
          )}
        </FadeIn>

        <FadeIn delay={250}>
          <div className="mt-8 text-center">
            <Link
              href="/participantes"
              className="text-sm font-semibold text-collage-blue underline underline-offset-4 hover:text-collage-blue/80"
            >
              {m.participants.viewAll}
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
