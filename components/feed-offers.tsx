import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { FeedOffersRail } from '@/components/feed-offers-rail'
import { TrackedLink, TrackVisible } from '@/components/track'
import { isClubOpen } from '@/lib/club-launch'
import { FEED_OFFER_EVENTS } from '@/lib/funnel'
import { fmt } from '@/lib/i18n/format'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { getI18n } from '@/lib/i18n/server'
import { cutoutPlans } from '@/lib/store'
import { cn } from '@/lib/utils'

// One brand colour per banner, so three sheets in a row read as three
// different things. Text on the red is the full paper (4.6:1, the most the
// red allows); the ochre is too light for paper text and takes the ink.
const TONES = {
  blue: { paper: 'bg-collage-blue', text: 'text-paper', body: 'text-paper/85', cta: 'bg-paper text-ink' },
  red: { paper: 'bg-collage-red', text: 'text-paper', body: 'text-paper font-medium', cta: 'bg-ink text-paper' },
  ochre: { paper: 'bg-collage-yellow', text: 'text-ink', body: 'text-ink/85', cta: 'bg-ink text-paper' },
} as const

// Each sheet sits a little crooked, like paper laid on a table, and
// straightens when it's hovered.
const TILTS = ['-rotate-[0.8deg]', 'rotate-[0.6deg]', '-rotate-[0.4deg]']
// Where each sheet's tear starts along public/collage/torn-edge-top.svg.
const TEARS = ['0px', '-410px', '-820px']

type Event = (typeof FEED_OFFER_EVENTS)[number]['name']
type Slide = {
  href: string
  event: Exclude<Event, 'feed_offers_seen'>
  image: string
  /** Where the photo is cropped for the 2:1 frame. */
  focus: string
  tag: string
  title: string
  body: string
  cta: string
  tone: keyof typeof TONES
}

/**
 * Banners at the top of a participating artist's home (the obra feed): what
 * they can take on beyond their entry — their own gallery in the Club, the
 * monthly cutouts — and the 3D gallery, which is free. Each shows a real
 * picture of what it opens: a Club room and the main gallery, captured from
 * the site itself, and the store's product photo. The Club's appears only
 * while the Club is open (lib/club-launch.ts). Rendered with the feed, which
 * already reads the session, from data in the code: no query of its own.
 */
export async function FeedOffers({ firstName }: { firstName?: string }) {
  const { locale, m } = await getI18n()
  const t = m.feedOffers
  const counts = new Intl.ListFormat(LOCALE_INFO[locale].intl, { type: 'disjunction' }).format(cutoutPlans.map((plan) => String(plan.count)))

  const slides: Slide[] = [
    ...(isClubOpen()
      ? [{
          ...t.club, href: '/club', event: 'feed_offer_club' as const, image: '/muestra/club-sala.jpg', focus: '50% 62%', tone: 'blue' as const,
          tag: firstName ? fmt(t.club.tag, { name: firstName }) : t.club.tagNoName,
        }]
      : []),
    { ...t.cutouts, href: '/tienda#recortes', event: 'feed_offer_cutouts', image: '/tienda-productos.webp', focus: '50% 55%', tone: 'red', body: fmt(t.cutouts.body, { counts }) },
    { ...t.gallery, href: '/galeria-3d', event: 'feed_offer_gallery', image: '/muestra/galeria-3d.jpg', focus: '50% 65%', tone: 'ochre' },
  ]

  return (
    <FeedOffersRail labels={{ label: t.label, prev: t.prev, next: t.next, goTo: t.goTo }}>
      {slides.map((slide, i) => {
        const tone = TONES[slide.tone]
        return (
          <li key={slide.href} className="relative w-[86%] shrink-0 snap-start sm:w-[80%]">
            {i === 0 && <TrackVisible event="feed_offers_seen" />}
            <TrackedLink
              href={slide.href}
              event={slide.event}
              // Named by its title, described by its text: the tag and the
              // button's words would only repeat them.
              aria-labelledby={`${slide.event}-title`}
              aria-describedby={`${slide.event}-body`}
              className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-[3px] shadow-[0_14px_24px_-14px_rgb(27_17_12/0.55)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-0 hover:shadow-[0_24px_36px_-18px_rgb(27_17_12/0.6)] focus-visible:rotate-0 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-collage-blue active:scale-[0.985] motion-safe:hover:-translate-y-1 motion-reduce:transition-none',
                tone.paper,
                tone.text,
                TILTS[i % TILTS.length],
              )}
            >
              {/* Wide and short: the row takes about half a screen, so the
                  first obra of the feed already shows underneath. */}
              <div className="relative aspect-[3/1] overflow-hidden bg-ink/15">
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 450px, (min-width: 640px) 80vw, 86vw"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  style={{ objectPosition: slide.focus }}
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.06]"
                />
                {/* A strip of paper taped over the photo: the one fact to know. */}
                <span className="absolute top-2.5 left-2.5 -rotate-[2.5deg] bg-paper px-2 py-0.5 text-xs font-bold tracking-wide text-ink uppercase shadow-[0_2px_5px_rgb(27_17_12/0.3)]">
                  {slide.tag}
                </span>
              </div>
              {/* The coloured sheet is torn along its top and laid over the photo. */}
              <div
                className={cn('torn-t relative -mt-3.5 flex flex-1 items-end gap-3 px-4 pt-5 pb-3.5 sm:px-5', tone.paper)}
                style={{ '--tear': TEARS[i % TEARS.length] } as React.CSSProperties}
              >
                <span aria-hidden="true" className="grain-overlay pointer-events-none absolute inset-0" />
                <span className="relative min-w-0 flex-1 self-start">
                  {/* Not a heading: the banners sit above the page's own h1. */}
                  <span id={`${slide.event}-title`} className="block font-display text-[1.35rem] leading-[1.05] tracking-tight text-balance uppercase sm:text-[1.55rem]">{slide.title}</span>
                  <span id={`${slide.event}-body`} className={cn('mt-1 block text-sm leading-snug text-pretty', tone.body)}>{slide.body}</span>
                </span>
                {/* On a phone the arrow alone, so the text keeps the width;
                    wider, the action in words. */}
                <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold sm:inline-flex sm:size-auto sm:min-h-10 sm:gap-2 sm:px-4', tone.cta)}>
                  <span className="hidden whitespace-nowrap sm:inline">{slide.cta}</span>
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </div>
            </TrackedLink>
          </li>
        )
      })}
    </FeedOffersRail>
  )
}
