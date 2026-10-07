'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startMpSubscription, type MpSubscriptionState } from '@/app/[locale]/(site)/tienda/actions'
import type { MagazineField } from '@/lib/magazine'
import { ShippingLocationFields } from '@/components/shipping-location-fields'
import type { SubscriptionPlan } from '@/lib/store'
import { useI18n } from '@/lib/i18n/client'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'

const initial: MpSubscriptionState = { error: null, invalid: [], values: {} }

// Subscribing from Argentina: shipping details here, then Mercado Pago to
// authorize the monthly charge in pesos (app/tienda/actions.ts).
export function MpSubscriptionCheckout({ plan, featured }: { plan: SubscriptionPlan['id']; featured?: boolean }) {
  const { m } = useI18n()
  const t = m.store.mp
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(startMpSubscription.bind(null, plan), initial)

  if (!open) {
    return (
      <Button size="lg" variant={featured ? 'default' : 'primary'} className="mt-8 w-full" onClick={() => { track('store_checkout_open'); setOpen(true) }}>
        {t.subscribe}
      </Button>
    )
  }

  const field = (name: MagazineField, label: string, props: React.ComponentProps<'input'> = {}) => (
    <label className="block text-xs font-medium">
      {label}
      <input
        name={name}
        aria-invalid={state.invalid.includes(name) || undefined}
        {...props}
        defaultValue={state.values[name] ?? props.defaultValue}
        className={cn(
          'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground',
          state.invalid.includes(name) ? 'border-collage-red' : 'border-input',
        )}
      />
    </label>
  )

  return (
    <form action={action} className="mt-8 space-y-3 border-t-2 border-current/15 pt-6 text-left">
      <p className="text-center text-sm font-semibold">{t.details}</p>
      {field('name', t.name, { required: true, autoComplete: 'name', maxLength: 120 })}
      {field('email', t.email, { required: true, type: 'email', autoComplete: 'email', maxLength: 254 })}
      {field('phone', t.phone, { required: true, type: 'tel', autoComplete: 'tel', maxLength: 30 })}
      {field('address_line_1', t.address, { required: true, autoComplete: 'address-line1', maxLength: 200 })}
      {field('address_line_2', t.apartment, { autoComplete: 'address-line2', maxLength: 100 })}
      <ShippingLocationFields labels={{ province: t.province, city: t.city, postal: t.postalCode }} values={{ province: state.values.province, city: state.values.city, postal: state.values.postal_code }} invalid={state.invalid} />
      {/* Honeypot — see startMpSubscription. */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state.error && <p role="alert" className="text-center text-sm text-collage-red">{t.errors[state.error]}</p>}
      <Button type="submit" size="lg" variant={featured ? 'default' : 'primary'} disabled={pending} className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {t.submit}
      </Button>
      <p className="text-center text-xs opacity-75">{t.redirect}</p>
      <button type="button" className="w-full text-center text-xs underline" onClick={() => setOpen(false)}>{t.cancel}</button>
    </form>
  )
}
