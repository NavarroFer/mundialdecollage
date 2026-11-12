/* Team photos are static files in public/equipo/, so a plain <img> is enough. */
/* eslint-disable @next/next/no-img-element */

import { Instagram } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { fmt } from '@/lib/i18n/format'
import { team, type TeamMember } from '@/lib/team'
import { getI18n } from '@/lib/i18n/server'

const accents = {
  blue: { name: 'text-collage-blue', handle: 'text-collage-red' },
  red: { name: 'text-collage-red', handle: 'text-collage-blue' },
} as const

/**
 * Optional polaroid held by tape. Both photos get the same treatment so they
 * read as one series: a colour wash in the brand colour of the person's name
 * (it keeps each photo's own light), a layer of paper grain, opposite tilts.
 * The card is just as complete without it.
 */
function Photo({ member, tilt, alt }: { member: TeamMember; tilt: string; alt: string }) {
  if (!member.photo) return null
  const wash = member.accent === 'blue' ? 'bg-collage-blue' : 'bg-collage-red'
  return (
    <figure className={`relative mx-auto w-48 shrink-0 bg-paper p-2.5 pb-8 shadow-[0_14px_22px_-12px_rgb(27_17_12/0.55)] sm:mx-0 sm:w-44 ${tilt}`}>
      <span aria-hidden className="tape -top-2.5 left-1/2 -translate-x-1/2 -rotate-3" />
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <img
          src={member.photo}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block size-full object-cover"
          style={{ objectPosition: member.photoPosition }}
        />
        <span aria-hidden className={`absolute inset-0 mix-blend-color ${wash}`} style={{ opacity: member.wash }} />
        <span aria-hidden className="grain-overlay pointer-events-none absolute inset-0" />
      </div>
    </figure>
  )
}

/** The two founders, as paper cards with an ink border and a soft paper shadow. */
export async function AboutTeam() {
  const { m } = await getI18n()
  return (
    <ul className="mx-auto mt-14 grid max-w-5xl gap-6 px-5 text-left sm:px-8 lg:grid-cols-2 lg:gap-8">
      {team.map((member, index) => {
        const accent = accents[member.accent]
        return (
          <li key={member.id} className="flex">
            <FadeIn delay={index * 120} className="flex w-full">
              <article className={`flex h-full w-full flex-col rounded-3xl border-2 border-ink bg-card p-6 shadow-[0_10px_20px_-14px_rgb(27_17_12/0.5)] sm:p-8 ${index === 0 ? '-rotate-[0.4deg]' : 'rotate-[0.4deg]'}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <Photo member={member} tilt={index === 0 ? '-rotate-2' : 'rotate-2'} alt={fmt(m.about.team.portrait, { name: member.name })} />
                  <div className="min-w-0 text-center sm:text-left">
                    <h3 className={`font-display text-3xl leading-[0.95] tracking-tight break-words uppercase sm:text-4xl ${accent.name}`}>{member.name}</h3>
                    <a
                      href={member.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 text-base font-bold break-words underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue ${accent.handle}`}
                    >
                      <Instagram aria-hidden className="size-4 shrink-0" />
                      {member.handle}
                      <span className="sr-only"> {m.common.opensInNewTab}</span>
                    </a>
                  </div>
                </div>
                <hr className="my-4 border-ink/15" />
                <ul className="list-disc space-y-2.5 pl-5 text-base text-ink marker:text-ink/60 sm:text-lg">
                  {m.about.team[member.id].map((line) => <li key={line}>{line}</li>)}
                </ul>
              </article>
            </FadeIn>
          </li>
        )
      })}
    </ul>
  )
}
