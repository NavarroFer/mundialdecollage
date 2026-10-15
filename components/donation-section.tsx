import { DonationForm } from '@/components/donation-form'
import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'

// «Doná para que siga ocurriendo» on the home (lib/donations.ts). Static like
// the rest of the page: Mercado Pago is only asked when someone taps an amount.
// #donar is where a payment that didn't go through comes back to.
export async function DonationSection() {
  const { m } = await getI18n()
  const t = m.donate
  return (
    <section id="donar" aria-labelledby="donate-title" className="bg-grain scroll-mt-20 border-t-2 border-ink/10 py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 sm:px-8 md:grid-cols-[1.1fr_1fr]">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
            {t.eyebrow}
          </span>
          <h2 id="donate-title" className="font-display mt-6 text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.title}</h2>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">{t.body}</p>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="rotate-[0.5deg] rounded-3xl border-2 border-ink/15 bg-card p-5 sm:p-7">
            <DonationForm origin="home" />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
