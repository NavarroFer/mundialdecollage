import Link from 'next/link'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { TrackView } from '@/components/track'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { syncPayment } from '@/lib/payments/apply'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { getI18n } from '@/lib/i18n/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Where Mercado Pago sends the buyer back (success, pending and failure alike).
// The payment is re-fetched from Mercado Pago and applied here too, so the
// order is up to date even when the webhook is late. Only the order's status
// is shown — nothing from it that the unguessable id could leak.
export default async function MagazineThanksPage({ searchParams }: {
  searchParams: Promise<{ pedido?: string; payment_id?: string; collection_id?: string }>
}) {
  const params = await searchParams
  const paymentId = params.payment_id ?? params.collection_id
  if (paymentId) await syncPayment(mercadoPago, paymentId, 'magazine')

  let status: string | null = null
  if (params.pedido && UUID_PATTERN.test(params.pedido) && isSupabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await createAdminClient().from('magazine_orders').select('status, mp_payment_id').eq('id', params.pedido).maybeSingle()
    // A checkout left without paying has no payment yet: same as a failure
    // for the buyer — nothing was charged.
    status = data ? (data.status === 'pending' && !data.mp_payment_id ? 'failed' : data.status) : null
  }

  const { m } = await getI18n()
  const t = m.magazine
  const view = status === 'paid'
    ? { Icon: CheckCircle2, color: 'text-collage-blue', title: t.paidTitle, body: t.paidBody }
    : status === 'pending'
      ? { Icon: Clock, color: 'text-collage-yellow', title: t.pendingTitle, body: t.pendingBody }
      : { Icon: XCircle, color: 'text-collage-red', title: t.failedTitle, body: t.failedBody }

  return (
    <>
      {status === 'paid' && <TrackView event="magazine_paid" />}
      <SiteHeader />
      <main className="bg-grain min-h-[70vh] py-24 sm:py-32">
        <section className="mx-auto max-w-2xl px-5 text-center sm:px-8">
          <view.Icon className={`mx-auto h-14 w-14 ${view.color}`} aria-hidden="true" />
          <h1 className="font-display mt-7 text-4xl tracking-tight uppercase sm:text-5xl">{view.title}</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">{view.body}</p>
          <div className="mt-10 flex flex-col items-center gap-3">
            {status !== 'paid' && status !== 'pending' && (
              <Button asChild size="lg"><Link href="/revista">{t.retry}</Link></Button>
            )}
            <Button asChild variant="outline"><Link href="/">{t.back}</Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
