import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'

// Mercado Pago's `back_urls.pending` target after checkout — e.g. a bank
// transfer or a payment method that takes a while to be accredited.
export default function TallerPendientePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden py-24 sm:py-32">
          <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block rotate-2 bg-collage-yellow px-5 py-2 text-xs font-bold tracking-[0.2em] text-ink uppercase sm:text-sm">
              Pago en proceso
            </span>

            <h1 className="font-display mt-8 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
              Tu pago está siendo procesado
            </h1>

            <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">
              Te confirmamos por mail apenas se acredite — algunos medios de
              pago, como las transferencias, pueden tardar un rato. No hace
              falta que hagas nada más.
            </p>

            <div className="mt-10 flex justify-center">
              <Link href="/">
                <Button size="lg" variant="outline">
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
