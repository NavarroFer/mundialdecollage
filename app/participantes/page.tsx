import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getParticipants } from '@/lib/participants'
import { flagSvgsFor } from '@/lib/flag-svg'
import { ParticipantsDirectory } from './participants-directory'
import { getI18n } from '@/lib/i18n/server'

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default async function ParticipantesPage() {
  const [participants, { m }] = await Promise.all([getParticipants(), getI18n()])

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <FadeIn>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            {m.common.backHome}
          </Link>

          <p className="mt-8 text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            {m.participantsPage.eyebrow}
          </p>
          <h1 className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-4xl">
            {m.participantsPage.title}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            {m.participantsPage.body}
          </p>
        </FadeIn>

        {participants.length > 0 ? (
          <FadeIn delay={150}>
            <ParticipantsDirectory
              participants={participants}
              flags={flagSvgsFor(participants.map(({ countryCode }) => countryCode))}
            />
          </FadeIn>
        ) : (
          <FadeIn delay={150}>
            <p className="mt-12 text-center text-muted-foreground">
              {m.participantsPage.empty}
            </p>
          </FadeIn>
        )}
      </div>
    </main>
  )
}
