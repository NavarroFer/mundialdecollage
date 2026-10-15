import { ArrowRight, Scissors, Star } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink, TrackVisible } from '@/components/track'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { cutoutPlans, subscriptionPlans } from '@/lib/store'
import { cn } from '@/lib/utils'

// Ruled notebook paper, for the membership's notebook.
const RULED = { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 3cqw, color-mix(in srgb, var(--color-collage-blue) 22%, transparent) 3cqw calc(3cqw + 1px))' }
// The art is a thumbnail: everything in it is sized against its width (cqw).
const ART = 'bg-grain @container relative aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-xl min-[380px]:w-28 sm:w-36'
const SHADOW = 'shadow-[1cqw_1cqw_0_var(--color-ink)]'

// Each catalogue's cheapest plan. The home is the same for everyone (its
// anonymous copy is built ahead), so it can't know the visitor's country:
// pesos first, dollars for everyone else; /tienda picks the right one.
function startingPrice(plans: readonly { priceArs: number; priceUsd: number }[]) {
  return {
    ars: `ARS $${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.min(...plans.map((plan) => plan.priceArs)))}`,
    usd: `USD ${Math.min(...plans.map((plan) => plan.priceUsd))}`,
  }
}

// There's no product photo yet: each card draws what arrives, in paper.
function MembershipArt() {
  return (
    <div aria-hidden="true" className={cn(ART, 'bg-collage-blue')}>
      {/* Notebook */}
      <div className={cn('absolute top-[14%] left-[9%] h-[74%] w-[30%] -rotate-[8deg] overflow-hidden rounded-[1cqw] bg-paper', SHADOW)} style={RULED}>
        <div className="absolute inset-y-0 left-0 w-[16%] bg-collage-red" />
      </div>
      {/* Print: a tiny collage of its own */}
      <div className={cn('absolute top-[9%] left-[36%] h-[60%] w-[28%] rotate-[5deg] overflow-hidden bg-collage-yellow', SHADOW)}>
        <div className="absolute top-[16%] right-[16%] size-[34%] rounded-full bg-collage-red" />
        <div className="absolute inset-x-0 bottom-0 h-[52%] bg-ink/85 [clip-path:polygon(0_100%,0_55%,30%_10%,55%_60%,75%_30%,100%_70%,100%_100%)]" />
      </div>
      {/* Fanzine, folded in half */}
      <div className={cn('absolute right-[7%] bottom-[9%] h-[50%] w-[26%] -rotate-[4deg] bg-paper', SHADOW)}>
        <div className="absolute inset-y-0 left-1/2 border-l border-ink/20" />
        <div className="absolute top-[22%] left-[10%] h-[1.5cqw] w-[30%] bg-ink/70" />
        <div className="absolute top-[42%] left-[10%] h-[1cqw] w-[28%] bg-ink/25" />
        <div className="absolute top-[56%] left-[10%] h-[1cqw] w-[24%] bg-ink/25" />
        <div className="absolute top-[22%] right-[10%] h-[48%] w-[30%] bg-collage-blue/80" />
      </div>
      {/* Sticker */}
      <div className={cn('absolute top-[8%] right-[10%] grid size-[17cqw] rotate-12 place-items-center rounded-full border-[1.3cqw] border-paper bg-collage-red', SHADOW)}>
        <Star className="size-[7cqw] fill-paper text-paper" />
      </div>
    </div>
  )
}

function CutoutsArt() {
  const fan = ['left-[5%] -rotate-[10deg]', 'left-[35%] -translate-y-[2cqw] rotate-[-1deg]', 'left-[65%] rotate-[9deg]']
  return (
    <div aria-hidden="true" className={cn(ART, 'bg-collage-red')}>
      {/* Cut here */}
      <div className="absolute inset-x-0 top-[22%] border-t border-dashed border-paper/80" />
      <Scissors className="absolute top-[22%] left-[3%] size-[10cqw] -translate-y-1/2 -rotate-90 text-paper" />
      {/* Scraps */}
      <div className="absolute top-[5%] left-[32%] h-[6cqw] w-[11cqw] rotate-12 bg-collage-yellow [clip-path:polygon(0_20%,100%_0,85%_100%,10%_80%)]" />
      <div className="absolute top-[4%] right-[24%] size-[7cqw] -rotate-6 bg-paper [clip-path:polygon(50%_0,100%_70%,20%_100%)]" />
      <div className="absolute top-[9%] right-[6%] h-[5cqw] w-[12cqw] rotate-[20deg] bg-collage-blue [clip-path:polygon(0_0,100%_25%,90%_100%,5%_70%)]" />
      {/* The three packs */}
      {cutoutPlans.map((plan, i) => (
        <div
          key={plan.id}
          className={cn(
            'absolute bottom-[-8%] grid h-[62%] w-[30%] place-items-center rounded-[1.5cqw] border-t-2 border-dashed',
            SHADOW,
            plan.featured ? 'border-ink/30 bg-collage-yellow' : 'border-collage-red/30 bg-paper',
            fan[i],
          )}
        >
          <span className={cn('font-display text-[14cqw] leading-none', plan.featured ? 'text-ink' : 'text-collage-red')}>{plan.count}</span>
        </div>
      ))}
    </div>
  )
}

// A banner rather than a section of its own: it sits between the edition
// and the obras, so it should take well under a screen.
export async function HomeStoreSection() {
  const { m } = await getI18n()
  const t = m.store
  const home = t.home
  const counts = cutoutPlans.map((plan) => plan.count)
  const products = [
    { href: '/tienda#membresia', event: 'store_click_home_membership' as const, Art: MembershipArt, ...home.membership, price: startingPrice(subscriptionPlans) },
    {
      href: '/tienda#recortes', event: 'store_click_home_cutouts' as const, Art: CutoutsArt,
      ...home.cutouts,
      summary: fmt(home.cutouts.summary, { counts: `${counts.slice(0, -1).join(', ')} o ${counts.at(-1)}` }),
      price: startingPrice(cutoutPlans),
    },
  ]

  return (
    <section aria-labelledby="home-store-title" className="border-t-2 border-ink/10 bg-muted py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.badge}</p>
              <h2 id="home-store-title" className="font-display mt-1.5 text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.title}</h2>
            </div>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground lg:mt-0 lg:text-right">{home.intro}</p>
          </div>
          <TrackVisible event="store_home_seen" />
          <div className="mt-5 grid gap-3 lg:grid-cols-2 lg:gap-5">
            {products.map(({ href, event, Art, title, summary, price }) => (
              <TrackedLink
                key={href}
                href={href}
                event={event}
                className="group flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-card p-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-ink/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue motion-reduce:transition-none sm:gap-4 sm:p-3 sm:pr-4"
              >
                <Art />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl leading-tight tracking-tight text-ink uppercase sm:text-2xl">{title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{summary}</p>
                  <p className="mt-1.5 text-sm whitespace-nowrap text-ink">
                    <span className="text-muted-foreground">{home.from} </span>
                    <span className="font-bold">{price.ars}</span> {t.perMonth}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(home.abroad, { price: price.usd })}</p>
                </div>
                <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-collage-blue text-primary-foreground transition-colors group-hover:bg-ink sm:grid" aria-hidden="true">
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </TrackedLink>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{home.note}</p>
        </FadeIn>
      </div>
    </section>
  )
}
