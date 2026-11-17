import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { OfferBannersRail } from '@/components/offer-banners-rail'
import { TrackedLink, TrackVisible } from '@/components/track'
import { isClubOpen } from '@/lib/club-launch'
import { clubBanner, type OwnClubGallery } from '@/lib/offer-banners'
import type { FunnelEvent } from '@/lib/funnel'
import { fmt } from '@/lib/i18n/format'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { getI18n } from '@/lib/i18n/server'
import { cutoutPlans } from '@/lib/store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
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

type Banner = 'club' | 'myGallery' | 'cutouts' | 'gallery'

// Where the row is shown, and what changes with it. The feed is a narrow
// column, so its row always slides and its first photo is above the fold;
// the public home is wide, so from a laptop up its banners sit side by side,
// a little taller, and their photos wait until they're near. Each place
// records its own events (lib/funnel.ts), to compare them in /admin/estadisticas.
const PLACES = {
  feed: {
    seen: 'feed_offers_seen',
    events: { club: 'feed_offer_club', myGallery: 'feed_offer_my_gallery', cutouts: 'feed_offer_cutouts', gallery: 'feed_offer_gallery' },
    slide: 'w-[86%] sm:w-[80%]',
    photo: 'aspect-[3/1]',
    sizes: '(min-width: 1024px) 450px, (min-width: 640px) 80vw, 86vw',
    eager: true,
    wide: false,
  },
  home: {
    seen: 'home_offers_seen',
    events: { club: 'home_offer_club', myGallery: 'home_offer_my_gallery', cutouts: 'home_offer_cutouts', gallery: 'home_offer_gallery' },
    slide: 'w-[86%] sm:w-[60%] lg:w-auto lg:min-w-0 lg:flex-1',
    photo: 'aspect-[3/1] lg:aspect-[2/1]',
    sizes: '(min-width: 1024px) 360px, (min-width: 640px) 60vw, 86vw',
    eager: false,
    wide: true,
  },
} as const satisfies Record<string, { seen: FunnelEvent; events: Record<Banner, FunnelEvent>; slide: string; photo: string; sizes: string; eager: boolean; wide: boolean }>

type Slide = {
  href: string
  event: FunnelEvent
  image: string
  /** Where the photo is cropped for its wide frame. */
  focus: string
  tag: string
  title: string
  body: string
  cta: string
  tone: keyof typeof TONES
}

// The viewer's own Club gallery: one row, by its unique user_id, which its
// owner may read. Without a session (the home's anonymous copy) there is no
// query at all. Any failure reads as «none» and leaves the pitch.
async function ownClubGallery(userId: string | undefined): Promise<OwnClubGallery> {
  if (!isSupabaseConfigured || !userId) return null
  const { data, error } = await (await createClient()).from('club_galleries').select('status').eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data.status === 'active' ? 'active' : 'inactive'
}

/**
 * Banners for what an artist can take on beyond their entry — their own
 * gallery in the Club, the monthly cutouts — and the 3D gallery, which is
 * free. Atop a participating artist's home (the obra feed) and on the public
 * home. Each shows a real picture of what it opens: a Club room and the main
 * gallery, captured from the site itself, and the store's product photo. A
 * Club member gets a way into their gallery instead of the pitch, which
 * shows only while the Club is open (lib/offer-banners.ts). The session is
 * read only through getCurrentUser(), so the home's anonymous copy stays
 * static (lib/static-pages.ts).
 */
export async function OfferBanners({ place, className }: { place: keyof typeof PLACES; className?: string }) {
  const where = PLACES[place]
  const [{ locale, m }, user] = await Promise.all([getI18n(), isSupabaseConfigured ? getCurrentUser() : Promise.resolve(null)])
  const gallery = await ownClubGallery(user?.id)
  const t = m.offerBanners
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0]
  const counts = new Intl.ListFormat(LOCALE_INFO[locale].intl, { type: 'disjunction' }).format(cutoutPlans.map((plan) => String(plan.count)))
  const club = clubBanner(gallery, isClubOpen())

  const slides: Slide[] = [
    ...(club
      ? [{
          ...(club.kind === 'member' ? t.clubMember : t.club),
          href: club.href,
          event: where.events[club.kind === 'member' ? 'myGallery' : 'club'],
          image: '/muestra/club-sala.jpg', focus: '50% 62%', tone: 'blue' as const,
          tag: firstName ? fmt(t.club.tag, { name: firstName }) : t.club.tagNoName,
        }]
      : []),
    { ...t.cutouts, href: '/tienda#recortes', event: where.events.cutouts, image: '/tienda-productos.webp', focus: '50% 55%', tone: 'red', body: fmt(t.cutouts.body, { counts }) },
    { ...t.gallery, href: '/galeria-3d', event: where.events.gallery, image: '/muestra/galeria-3d.jpg', focus: '50% 65%', tone: 'ochre' },
  ]

  return (
    <OfferBannersRail labels={{ label: t.label, prev: t.prev, next: t.next, goTo: t.goTo }} wide={where.wide} className={className}>
      {slides.map((slide, i) => {
        const tone = TONES[slide.tone]
        const eager = where.eager && i === 0
        return (
          <li key={slide.href} className={cn('relative shrink-0 snap-start', where.slide)}>
            {i === 0 && <TrackVisible event={where.seen} />}
            <TrackedLink
              href={slide.href}
              event={slide.event}
              // Named by its title, described by its text: the tag and the
              // button's words would only repeat them.
              aria-labelledby={`${slide.event}-title`}
              aria-describedby={`${slide.event}-body`}
              className={cn(
                // A container, so the text and the button follow the sheet's
                // own width, which depends on the place more than the screen.
                'group @container relative flex h-full flex-col overflow-hidden rounded-[3px] shadow-[0_14px_24px_-14px_rgb(27_17_12/0.55)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-0 hover:shadow-[0_24px_36px_-18px_rgb(27_17_12/0.6)] focus-visible:rotate-0 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-collage-blue active:scale-[0.985] motion-safe:hover:-translate-y-1 motion-reduce:transition-none',
                tone.paper,
                tone.text,
                TILTS[i % TILTS.length],
              )}
            >
              {/* Wide and short: in the feed the row takes about half a
                  screen, so the first obra already shows underneath. */}
              <div className={cn('relative overflow-hidden bg-ink/15', where.photo)}>
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  sizes={where.sizes}
                  loading={eager ? 'eager' : 'lazy'}
                  fetchPriority={eager ? 'high' : 'auto'}
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
                className={cn('torn-t relative -mt-3.5 flex flex-1 items-end gap-3 px-4 pt-5 pb-3.5 @sm:px-5', tone.paper)}
                style={{ '--tear': TEARS[i % TEARS.length] } as React.CSSProperties}
              >
                <span aria-hidden="true" className="grain-overlay pointer-events-none absolute inset-0" />
                <span className="relative min-w-0 flex-1 self-start">
                  {/* Not a heading: in the feed the banners sit above the page's own h1. */}
                  <span id={`${slide.event}-title`} className="block font-display text-[1.35rem] leading-[1.05] tracking-tight text-balance uppercase @sm:text-[1.55rem]">{slide.title}</span>
                  <span id={`${slide.event}-body`} className={cn('mt-1 block text-sm leading-snug text-pretty', tone.body)}>{slide.body}</span>
                </span>
                {/* On a narrow sheet the arrow alone, so the text keeps the
                    width; on a wider one, the action in words. */}
                <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold @sm:inline-flex @sm:size-auto @sm:min-h-10 @sm:gap-2 @sm:px-4', tone.cta)}>
                  <span className="hidden whitespace-nowrap @sm:inline">{slide.cta}</span>
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </div>
            </TrackedLink>
          </li>
        )
      })}
    </OfferBannersRail>
  )
}
