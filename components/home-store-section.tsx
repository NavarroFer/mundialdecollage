import { ArrowRight, PackageOpen, Scissors } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink } from '@/components/track'
import { getI18n } from '@/lib/i18n/server'

export async function HomeStoreSection() {
  const { m } = await getI18n()
  const t = m.store
  const copy = t.subscriptions
  const products = [
    { href: '/tienda#membresia', event: 'store_click_home_membership' as const, icon: PackageOpen, title: copy.membershipTitle, body: copy.membershipBody, cta: copy.membershipNav },
    { href: '/tienda#recortes', event: 'store_click_home_cutouts' as const, icon: Scissors, title: copy.cutoutsNav, body: copy.cutoutsBody, cta: copy.cutoutsNav },
  ]

  return (
    <section aria-labelledby="home-store-title" className="border-t-2 border-ink/10 bg-muted py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.badge}</p>
          <h2 id="home-store-title" className="font-display mt-3 text-3xl tracking-tight text-ink uppercase sm:text-4xl">{t.title}</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {products.map(({ href, event, icon: Icon, title, body, cta }) => (
              <TrackedLink key={href} href={href} event={event} className="group flex items-start gap-4 rounded-2xl border-2 border-ink/15 bg-card p-5 transition-colors hover:border-collage-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue sm:p-6">
                <Icon className="size-9 shrink-0 text-collage-red" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-2xl tracking-tight text-ink uppercase">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-collage-blue group-hover:underline">{cta}<ArrowRight className="size-4" aria-hidden="true" /></span>
                </div>
              </TrackedLink>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
