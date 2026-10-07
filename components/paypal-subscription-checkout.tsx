'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { Button } from '@/components/ui/button'
import type { PaypalPlanKey } from '@/lib/payments/paypal/plans'
import { useI18n } from '@/lib/i18n/client'
import { ShippingLocationFields } from '@/components/shipping-location-fields'
import { countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { track } from '@/lib/track'

type FormValues = {
  given_name: string
  surname: string
  email: string
  full_name: string
  address_line_1: string
  address_line_2: string
  admin_area_2: string
  admin_area_1: string
  postal_code: string
  country_code: string
}

const blankForm: FormValues = {
  given_name: '', surname: '', email: '', full_name: '', address_line_1: '', address_line_2: '', admin_area_2: '', admin_area_1: '', postal_code: '', country_code: '',
}

function valid(form: FormValues) {
  return Boolean(form.given_name && form.surname && form.email && form.address_line_1 && form.admin_area_2 && /^[a-z]{2}$/i.test(form.country_code))
}

export function PaypalSubscriptionCheckout({ plan, clientId }: { plan: PaypalPlanKey; clientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [error, setError] = useState<string | null>(null)
  const { m, locale } = useI18n()
  const countries = useMemo(() => getAllCountryCodes().map((code) => ({ code, name: countryCodeToName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale)), [locale])
  const t = m.store.checkout
  const update = (field: keyof FormValues, value: string) => setForm((previous) => ({ ...previous, [field]: value }))

  if (!open) return <Button size="lg" variant="primary" className="mt-8 w-full" onClick={() => { track('store_checkout_open'); setOpen(true) }}>{t.subscribe}</Button>

  return (
    <div className="mt-8 space-y-4 border-t-2 border-ink/10 pt-6 text-left">
      <p className="text-center text-sm font-semibold">{t.details}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field autoComplete="given-name" label={t.firstName} value={form.given_name} onChange={(value) => update('given_name', value)} />
        <Field autoComplete="family-name" label={t.lastName} value={form.surname} onChange={(value) => update('surname', value)} />
      </div>
      <Field autoComplete="email" label={t.email} type="email" value={form.email} onChange={(value) => update('email', value)} />
      <details className="text-xs"><summary className="cursor-pointer underline">{t.fullName}</summary><Field required={false} autoComplete="shipping name" label={t.fullName} value={form.full_name} onChange={(value) => update('full_name', value)} /></details>
      <Field autoComplete="shipping address-line1" label={t.address} value={form.address_line_1} onChange={(value) => update('address_line_1', value)} />
      <Field required={false} autoComplete="shipping address-line2" label={t.apartment} value={form.address_line_2} onChange={(value) => update('address_line_2', value)} />
      <label className="block text-xs font-medium">{t.countryCode}<select name="country_code" required autoComplete="shipping country" value={form.country_code} onChange={(event) => setForm((previous) => ({ ...previous, country_code: event.target.value, admin_area_1: '', admin_area_2: '', postal_code: '' }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"><option value="">{m.countrySelect.placeholder}</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
      <ShippingLocationFields key={form.country_code} country={form.country_code} labels={{ province: t.state, city: t.city, postal: t.postalCode }} names={{ province: 'admin_area_1', city: 'admin_area_2', postal: 'postal_code' }} values={{ province: form.admin_area_1, city: form.admin_area_2, postal: form.postal_code }} provinceRequired={false} postalRequired={false} onChange={(field, value) => update(field === 'province' ? 'admin_area_1' : field === 'city' ? 'admin_area_2' : 'postal_code', value)} />
      <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'subscription', vault: true }}>
        <PayPalButtons
          disabled={!valid(form)}
          forceReRender={[form, plan]}
          style={{ layout: 'vertical', label: 'subscribe' }}
          createSubscription={async () => {
            setError(null)
            track('store_checkout_start')
            const response = await fetch('/api/paypal/subscriptions', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, customer: { email: form.email, given_name: form.given_name, surname: form.surname }, shipping: { full_name: form.full_name.trim() || `${form.given_name} ${form.surname}`.trim(), address_line_1: form.address_line_1, address_line_2: form.address_line_2, admin_area_2: form.admin_area_2, admin_area_1: form.admin_area_1, postal_code: form.postal_code, country_code: form.country_code } }),
            })
            if (!response.ok) {
              setError(t.startFailed)
              throw new Error('Could not create PayPal subscription')
            }
            return (await response.json() as { id: string }).id
          }}
          onApprove={async () => { track('store_checkout_approved'); router.push('/gracias?tipo=suscripcion') }}
          onError={() => setError(t.completeFailed)}
        />
      </PayPalScriptProvider>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <button type="button" className="w-full text-center text-xs underline" onClick={() => setOpen(false)}>{t.cancel}</button>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', maxLength, required = true, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number; required?: boolean; autoComplete?: string }) {
  return <label className="block text-xs font-medium">{label}<input autoComplete={autoComplete} required={required} type={type} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
}
