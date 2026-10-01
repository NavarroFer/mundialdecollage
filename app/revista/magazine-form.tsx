'use client'

import { useActionState, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startMagazineCheckout, type MagazineCheckoutState } from './actions'
import type { MagazineField } from '@/lib/magazine'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

const initial: MagazineCheckoutState = { error: null, invalid: [], values: {} }

export function MagazineForm({ priceArs, maxQuantity, defaultName, defaultEmail }: {
  priceArs: number
  maxQuantity: number
  defaultName: string
  defaultEmail: string
}) {
  const { locale, m } = useI18n()
  const t = m.magazine
  const [state, action, pending] = useActionState(startMagazineCheckout, initial)
  const [quantity, setQuantity] = useState(1)
  const ars = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  const invalid = (field: MagazineField) => state.invalid.includes(field)

  const field = (name: MagazineField, label: string, props: React.ComponentProps<'input'> = {}) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        aria-invalid={invalid(name) || undefined}
        className={cn(
          'mt-1.5 w-full rounded-lg border-2 bg-background px-4 py-2.5 text-sm',
          invalid(name) ? 'border-collage-red' : 'border-ink/15',
        )}
        {...props}
        defaultValue={state.values[name] ?? props.defaultValue}
      />
    </label>
  )

  return (
    <form action={action} className="space-y-4">
      {field('name', t.name, { required: true, autoComplete: 'name', maxLength: 120, defaultValue: defaultName })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('email', t.email, { required: true, type: 'email', autoComplete: 'email', maxLength: 254, defaultValue: defaultEmail })}
        {field('phone', t.phone, { required: true, type: 'tel', autoComplete: 'tel', maxLength: 30 })}
      </div>
      {field('address_line_1', t.address, { required: true, autoComplete: 'address-line1', maxLength: 200 })}
      {field('address_line_2', t.apartment, { autoComplete: 'address-line2', maxLength: 100 })}
      <div className="grid gap-4 sm:grid-cols-3">
        {field('city', t.city, { required: true, autoComplete: 'address-level2', maxLength: 100 })}
        {field('province', t.province, { required: true, autoComplete: 'address-level1', maxLength: 100 })}
        {field('postal_code', t.postalCode, { required: true, autoComplete: 'postal-code', maxLength: 10 })}
      </div>
      {/* Honeypot — see startMagazineCheckout. */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-ink/10 pt-4">
        <label className="text-sm font-medium">
          {t.quantity}
          <select
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-1.5 block min-h-11 rounded-lg border-2 border-ink/15 bg-background px-3 text-sm"
          >
            {Array.from({ length: maxQuantity }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="text-right">
          <span className="block text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t.total}</span>
          <span className="text-2xl font-bold tracking-tight">{ars(priceArs * quantity)}</span>
        </p>
      </div>

      {state.error && <p role="alert" className="rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{t.errors[state.error]}</p>}
      <Button type="submit" size="lg" variant="primary" disabled={pending} className="h-auto min-h-14 w-full whitespace-normal py-3">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {t.submit}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t.redirectNote}</p>
    </form>
  )
}
