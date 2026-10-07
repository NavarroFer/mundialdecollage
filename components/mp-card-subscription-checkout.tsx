'use client'

import Script from 'next/script'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { startMpSubscription, type MpSubscriptionState } from '@/app/[locale]/(site)/tienda/actions'
import { useI18n } from '@/lib/i18n/client'
import { planById, type SubscriptionPlan } from '@/lib/store'

type BrickData = { token: string; payer?: { email?: string } }
type Controller = { unmount: () => Promise<void> }
type MercadoPagoSdk = { bricks: () => { create: (kind: string, id: string, options: Record<string, unknown>) => Promise<Controller> } }
declare global {
  interface Window { MercadoPago?: new (key: string, options: { locale: string }) => MercadoPagoSdk }
}

export function MpCardSubscriptionCheckout({ plan, shipping, onBack, onResult }: {
  plan: SubscriptionPlan['id']
  shipping: FormData
  onBack: () => void
  onResult: (state: MpSubscriptionState) => void
}) {
  const { m } = useI18n()
  const t = m.store.mp.card
  const router = useRouter()
  const id = `mp-card-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const inFlight = useRef(false)
  const callbacks = useRef({ onResult, router, t })
  useEffect(() => { callbacks.current = { onResult, router, t } }, [onResult, router, t])

  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return
    let cancelled = false
    let controller: Controller | undefined
    const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!
    const sdk = new window.MercadoPago(key, { locale: 'es-AR' })
    void sdk.bricks().create('cardPayment', id, {
      initialization: { amount: Math.round((planById(plan)!.priceArs + Number(shipping.get('shipping_fee') ?? 0)) * 100) / 100 },
      customization: { paymentMethods: { maxInstallments: 1 } },
      callbacks: {
        onReady: () => { if (!cancelled) setLoading(false) },
        onError: () => { if (!cancelled) { setLoading(false); setError(callbacks.current.t.loadFailed) } },
        onSubmit: async (data: BrickData) => {
          if (cancelled || inFlight.current) throw new Error('Checkout already in progress')
          inFlight.current = true
          setPaying(true)
          setError(null)
          const form = new FormData()
          shipping.forEach((value, field) => form.append(field, value))
          form.set('payment_method', 'card')
          form.set('card_token', data.token)
          form.set('payer_email', data.payer?.email ?? '')
          let outcomeKnown = false
          let created = false
          try {
            const result = await startMpSubscription(plan, { error: null, invalid: [], values: {} }, form)
            outcomeKnown = true
            if (cancelled) return
            if (!result.subscription) {
              callbacks.current.onResult(result)
              setError(result.paymentError ? callbacks.current.t.errors[result.paymentError] : callbacks.current.t.errors.rejected)
              throw new Error('Subscription not created')
            }
            created = true
            callbacks.current.router.push(`/gracias?tipo=suscripcion&preapproval_id=${encodeURIComponent(result.subscription.id)}`)
          } catch (err) {
            if (!outcomeKnown && !cancelled) setUncertain(true)
            if (!cancelled) setError((previous) => previous ?? callbacks.current.t.connectionFailed)
            throw err
          } finally {
            inFlight.current = created || !outcomeKnown
            if (!cancelled) setPaying(false)
          }
        },
      },
    }).then((created) => {
      if (cancelled) void created.unmount().catch(() => {})
      else controller = created
    }).catch(() => { if (!cancelled) { setLoading(false); setError(callbacks.current.t.loadFailed) } })
    return () => { cancelled = true; if (controller) void controller.unmount().catch(() => {}) }
  }, [sdkReady, id, plan, shipping])

  return (
    <div className="mt-8 space-y-4 border-t-2 border-current/15 pt-6 text-left">
      <Script src="https://sdk.mercadopago.com/js/v2" onReady={() => setSdkReady(true)} onError={() => { setLoading(false); setError(t.loadFailed) }} />
      <p className="text-center text-sm font-semibold">{t.title}</p>
      <p className="text-sm text-muted-foreground">{t.description}</p>
      <p className="text-sm font-semibold">{m.store.pickup.mode}: {String(shipping.get('city') ?? '')} · {String(shipping.get('address_line_1') ?? '')}</p>
      <p className="text-sm font-semibold">{m.store.pickup.total}: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(planById(plan)!.priceArs + Number(shipping.get('shipping_fee') ?? 0))}{m.store.perMonth}</p>
      {loading && <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t.loading}</p>}
      {error && <p role="alert" className="text-sm text-collage-red">{error}</p>}
      <div id={id} aria-busy={paying} />
      {paying && <p role="status" className="text-center text-sm">{t.processing}</p>}
      <button type="button" disabled={paying || uncertain} onClick={onBack} className="w-full text-center text-sm underline disabled:opacity-50">{t.back}</button>
    </div>
  )
}
