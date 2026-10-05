import { Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink } from '@/components/track'
import { ObrasCollage } from '@/components/obras-collage'
import { getDailyExhibition } from '@/lib/gallery-artworks'
import { flagSvgsFor } from '@/lib/flag-svg'
import { getI18n } from '@/lib/i18n/server'

export async function ParticipantsSection() {
  // Only today's obras: each one already names its artist, so the home
  // doesn't repeat them as a list. The search covers finding anyone else.
  const [collageFinalists, { m }] = await Promise.all([getDailyExhibition(), getI18n()])

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

      <FadeIn delay={100}>
        {collageFinalists.length > 0 ? (
          <ObrasCollage
            finalists={collageFinalists}
            flags={flagSvgsFor(collageFinalists.map(({ countryCode }) => countryCode))}
            scrollDriven
          />
        ) : (
          <p className="mt-8 text-center text-muted-foreground">
            {m.participants.empty}
          </p>
        )}
      </FadeIn>

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
    </section>
  )
}
