import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'

export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams
  const isSubscription = tipo === 'suscripcion'

  return (
    <>
      <SiteHeader />
      <main className="bg-grain min-h-[70vh] py-24 sm:py-32">
        <section className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
          <CheckCircle2 className="mx-auto h-14 w-14 text-collage-blue" aria-hidden="true" />
          <span className="torn-strip mt-7 inline-block rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">Thank you</span>
          <h1 className="font-display mt-7 text-4xl tracking-tight uppercase sm:text-5xl">
            {isSubscription ? 'Welcome to the club' : 'We received your order'}
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            {isSubscription
              ? "Your subscription request is on its way. Mercado Pago will email you with the payment details shortly."
              : "We received your order. You'll get an email shortly once Mercado Pago confirms the payment."}
          </p>
          <Button asChild size="lg" className="mt-10"><Link href="/tienda">Back to the shop</Link></Button>
        </section>
      </main>
      <Footer />
    </>
  )
}
