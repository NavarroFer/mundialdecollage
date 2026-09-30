import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { getI18n } from '@/lib/i18n/server'

export default async function GraciasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams
  const isSubscription = tipo === 'suscripcion'
  const { m } = await getI18n()
  const t = m.store.thanks

  return (
    <>
      <SiteHeader />
      <main className="bg-grain min-h-[70vh] py-24 sm:py-32">
        <section className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
          <CheckCircle2 className="mx-auto h-14 w-14 text-collage-blue" aria-hidden="true" />
          <span className="torn-strip mt-7 inline-block rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">{t.badge}</span>
          <h1 className="font-display mt-7 text-4xl tracking-tight uppercase sm:text-5xl">
            {isSubscription ? t.subscriptionTitle : t.orderTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            {isSubscription
              ? t.subscriptionBody
              : t.orderBody}
          </p>
          <Button asChild size="lg" className="mt-10"><Link href="/tienda">{t.back}</Link></Button>
        </section>
      </main>
      <Footer />
    </>
  )
}
