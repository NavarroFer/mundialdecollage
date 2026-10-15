import { ArrowRight, Scissors, Star } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink, TrackVisible } from '@/components/track'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { cutoutPlans, subscriptionPlans } from '@/lib/store'
import { cn } from '@/lib/utils'

// Ruled notebook paper, for the membership's notebook.
const RULED = { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 9px, color-mix(in srgb, var(--color-collage-blue) 22%, transparent) 9px 10px)' }

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
    <div aria-hidden="true" className="bg-grain relative h-36 overflow-hidden bg-collage-blue sm:h-44">
      {/* Notebook */}
      <div className="absolute top-[14%] left-[9%] h-[74%] w-[30%] -rotate-[8deg] overflow-hidden rounded-sm bg-paper shadow-[4px_4px_0_var(--color-ink)]" style={RULED}>
        <div className="absolute inset-y-0 left-0 w-[16%] bg-collage-red" />
      </div>
      {/* Print: a tiny collage of its own */}
      <div className="absolute top-[9%] left-[36%] h-[60%] w-[28%] rotate-[5deg] overflow-hidden bg-collage-yellow shadow-[4px_4px_0_var(--color-ink)]">
        <div className="absolute top-[16%] right-[16%] size-[34%] rounded-full bg-collage-red" />
        <div className="absolute inset-x-0 bottom-0 h-[52%] bg-ink/85 [clip-path:polygon(0_100%,0_55%,30%_10%,55%_60%,75%_30%,100%_70%,100%_100%)]" />
      </div>
      {/* Fanzine, folded in half */}
      <div className="absolute right-[7%] bottom-[9%] h-[50%] w-[26%] -rotate-[4deg] bg-paper shadow-[4px_4px_0_var(--color-ink)]">
        <div className="absolute inset-y-0 left-1/2 border-l-2 border-ink/20" />
        <div className="absolute top-[22%] left-[10%] h-1.5 w-[30%] bg-ink/70" />
        <div className="absolute top-[42%] left-[10%] h-1 w-[28%] bg-ink/25" />
        <div className="absolute top-[56%] left-[10%] h-1 w-[24%] bg-ink/25" />
        <div className="absolute top-[22%] right-[10%] h-[48%] w-[30%] bg-collage-blue/80" />
      </div>
      {/* Sticker */}
      <div className="absolute top-[10%] right-[12%] grid size-12 rotate-12 place-items-center rounded-full border-4 border-paper bg-collage-red shadow-[3px_3px_0_var(--color-ink)] sm:size-14">
        <Star className="size-5 fill-paper text-paper" />
      </div>
    </div>
  )
}

function CutoutsArt() {
  const fan = ['left-[7%] -rotate-[10deg]', 'left-[35%] -translate-y-2 rotate-[-1deg]', 'left-[63%] rotate-[9deg]']
  return (
    <div aria-hidden="true" className="bg-grain relative h-36 overflow-hidden bg-collage-red sm:h-44">
      {/* Cut here */}
      <div className="absolute inset-x-0 top-[20%] border-t-2 border-dashed border-paper/70" />
      <Scissors className="absolute top-[20%] left-[3%] size-7 -translate-y-1/2 -rotate-90 text-paper" />
      {/* Scraps */}
      <div className="absolute top-[5%] left-[30%] h-5 w-9 rotate-12 bg-collage-yellow [clip-path:polygon(0_20%,100%_0,85%_100%,10%_80%)]" />
      <div className="absolute top-[4%] right-[24%] h-6 w-6 -rotate-6 bg-paper [clip-path:polygon(50%_0,100%_70%,20%_100%)]" />
      <div className="absolute top-[8%] right-[8%] h-4 w-10 rotate-[20deg] bg-collage-blue [clip-path:polygon(0_0,100%_25%,90%_100%,5%_70%)]" />
      {/* The three packs */}
      {cutoutPlans.map((plan, i) => (
        <div
          key={plan.id}
          className={cn(
            'absolute bottom-[-8%] grid h-[66%] w-[30%] place-items-center rounded-md border-t-4 border-dashed shadow-[4px_4px_0_var(--color-ink)]',
            plan.featured ? 'border-ink/30 bg-collage-yellow' : 'border-collage-red/30 bg-paper',
            fan[i],
          )}
        >
          <span className={cn('font-display text-4xl leading-none sm:text-5xl', plan.featured ? 'text-ink' : 'text-collage-red')}>{plan.count}</span>
        </div>
      ))}
    </div>
  )
}

export async function HomeStoreSection() {
  const { m } = await getI18n()
  const t = m.store
  const home = t.home
  const counts = cutoutPlans.map((plan) => plan.count)
  const products = [
    {
      href: '/tienda#membresia', event: 'store_click_home_membership' as const, Art: MembershipArt,
      ...home.membership, price: startingPrice(subscriptionPlans),
    },
    {
      href: '/tienda#recortes', event: 'store_click_home_cutouts' as const, Art: CutoutsArt,
      ...home.cutouts,
      points: home.cutouts.points.map((point) => fmt(point, { counts: `${counts.slice(0, -1).join(', ')} o ${counts.at(-1)}` })),
      price: startingPrice(cutoutPlans),
    },
  ]

  return (
    <section aria-labelledby="home-store-title" className="border-t-2 border-ink/10 bg-muted py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.badge}</p>
          <h2 id="home-store-title" className="font-display mt-3 text-3xl tracking-tight text-ink uppercase sm:text-4xl">{t.title}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{home.intro}</p>
          <TrackVisible event="store_home_seen" />
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {products.map(({ href, event, Art, eyebrow, title, points, cta, price }) => (
              <TrackedLink
                key={href}
                href={href}
                event={event}
                className="group flex flex-col overflow-hidden rounded-2xl border-2 border-ink/15 bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Art />
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="text-xs font-bold tracking-[0.16em] text-collage-red uppercase">{eyebrow}</p>
                  <h3 className="font-display mt-1.5 text-3xl tracking-tight text-ink uppercase">{title}</h3>
                  <p className="mt-3 text-ink">
                    <span className="text-sm text-muted-foreground">{home.from} </span>
                    <span className="text-2xl font-bold tracking-tight">{price.ars}</span>
                    <span className="text-sm font-medium"> {t.perMonth}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{fmt(home.abroad, { price: price.usd })}</p>
                  <ul className="mt-4 space-y-1.5 border-t-2 border-ink/10 pt-4 text-sm text-ink">
                    {points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-[0.45em] size-1.5 shrink-0 rotate-45 bg-collage-red" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-collage-blue px-5 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-ink">
                    {cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </div>
              </TrackedLink>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{home.note}</p>
        </FadeIn>
      </div>
    </section>
  )
}
