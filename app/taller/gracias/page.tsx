import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'

// Mercado Pago's `back_urls.success` target after checkout.
export default function TallerGraciasPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden py-24 sm:py-32">
          <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-2 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
              Inscripción recibida
            </span>

            <h1 className="font-display mt-8 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
              ¡Gracias! Tu lugar en el taller está reservado
            </h1>

            <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">
              Ya recibimos tu pago. La confirmación puede tardar un minuto en
              reflejarse mientras Mercado Pago nos avisa — si te llegó el
              comprobante, ya está todo en orden.
            </p>

            <div className="mt-10 flex justify-center">
              <Link href="/">
                <Button size="lg">Volver al inicio</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
