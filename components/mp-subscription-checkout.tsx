'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startMpSubscription, type MpSubscriptionState } from '@/app/[locale]/(site)/tienda/actions'
import { ShippingLocationFields } from '@/components/shipping-location-fields'
import { MAGAZINE_FIELDS, type MagazineField } from '@/lib/magazine'
import type { SubscriptionPlan } from '@/lib/store'
import { useI18n } from '@/lib/i18n/client'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { MpCardSubscriptionCheckout } from '@/components/mp-card-subscription-checkout'

const initial: MpSubscriptionState = { error: null, invalid: [], values: {} }

// Subscribing from Argentina: shipping details here, then Mercado Pago to
// authorize the monthly charge in pesos (app/tienda/actions.ts).
export function MpSubscriptionCheckout({ plan, featured }: { plan: SubscriptionPlan['id']; featured?: boolean }) {
  const { m } = useI18n()
  const t = m.store.mp
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(startMpSubscription.bind(null, plan), initial)
  const cardAvailable = Boolean(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY)
  const [method, setMethod] = useState<'card' | 'account'>(cardAvailable ? 'card' : 'account')
  const [shipping, setShipping] = useState<FormData | null>(null)
  const [cardResult, setCardResult] = useState<MpSubscriptionState | null>(null)
  const result = cardResult ?? state

  if (!open) {
    return (
      <Button size="lg" variant={featured ? 'default' : 'primary'} className="mt-8 w-full" onClick={() => { track('store_checkout_open'); setOpen(true) }}>
        {t.subscribe}
      </Button>
    )
  }

  if (shipping) return <MpCardSubscriptionCheckout plan={plan} shipping={shipping} onResult={setCardResult} onBack={() => {
    setCardResult((previous) => ({ ...previous, error: null, invalid: previous?.invalid ?? [], values: Object.fromEntries(MAGAZINE_FIELDS.map((field) => [field, String(shipping.get(field) ?? '')])) }))
    setShipping(null)
  }} />

  const field = (name: MagazineField, label: string, props: React.ComponentProps<'input'> = {}) => (
    <label className="block text-xs font-medium">
      {label}
      <input
        name={name}
        aria-invalid={result.invalid.includes(name) || undefined}
        {...props}
        defaultValue={result.values[name] ?? props.defaultValue}
        className={cn(
          'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground',
          result.invalid.includes(name) ? 'border-collage-red' : 'border-input',
        )}
      />
    </label>
  )

  return (
    <form action={action} onSubmit={(event) => {
      setCardResult(null)
      if (method === 'card') {
        event.preventDefault()
        setShipping(new FormData(event.currentTarget))
      }
    }} className="mt-8 space-y-3 border-t-2 border-current/15 pt-6 text-left">
      <p className="text-center text-sm font-semibold">{t.details}</p>
      {field('name', t.name, { required: true, autoComplete: 'name', maxLength: 120 })}
      {field('email', t.email, { required: true, type: 'email', autoComplete: 'email', maxLength: 254 })}
      {field('phone', t.phone, { required: true, type: 'tel', autoComplete: 'tel', maxLength: 30 })}
      {field('address_line_1', t.address, { required: true, autoComplete: 'address-line1', maxLength: 200 })}
      {field('address_line_2', t.apartment, { autoComplete: 'address-line2', maxLength: 100 })}
      <ShippingLocationFields labels={{ province: t.province, city: t.city, postal: t.postalCode }} values={{ province: result.values.province, city: result.values.city, postal: result.values.postal_code }} invalid={result.invalid} />
      <fieldset className="space-y-2 border-t border-current/15 pt-3">
        <legend className="text-sm font-semibold">{t.paymentMethod}</legend>
        {cardAvailable && <label className="flex items-center gap-2 text-sm"><input type="radio" name="payment_method" value="card" checked={method === 'card'} onChange={() => setMethod('card')} />{t.card.option}</label>}
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="payment_method" value="account" checked={method === 'account'} onChange={() => setMethod('account')} />{t.accountOption}</label>
      </fieldset>
      {method === 'account' && <label className="block text-xs font-medium">{t.payerEmail}<input name="payer_email" type="email" required autoComplete="email" maxLength={254} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><span className="mt-1 block text-xs text-muted-foreground">{t.payerEmailHelp}</span></label>}
      {/* Honeypot — see startMpSubscription. */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {result.error && <p role="alert" className="text-center text-sm text-collage-red">{t.errors[result.error]}</p>}
      <Button type="submit" size="lg" variant={featured ? 'default' : 'primary'} disabled={pending} className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {method === 'card' ? t.card.continue : t.submit}
      </Button>
      <p className="text-center text-xs opacity-75">{method === 'card' ? t.card.description : t.redirect}</p>
      <button type="button" className="w-full text-center text-xs underline" onClick={() => setOpen(false)}>{t.cancel}</button>
    </form>
  )
}
