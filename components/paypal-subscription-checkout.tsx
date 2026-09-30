'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { Button } from '@/components/ui/button'
import type { PaypalPlanKey } from '@/lib/payments/paypal/plans'

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
  return Boolean(form.given_name && form.surname && form.email && form.full_name && form.address_line_1 && form.admin_area_2 && /^[a-z]{2}$/i.test(form.country_code))
}

export function PaypalSubscriptionCheckout({ plan, clientId }: { plan: PaypalPlanKey; clientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [error, setError] = useState<string | null>(null)
  const update = (field: keyof FormValues, value: string) => setForm((previous) => ({ ...previous, [field]: value }))

  if (!open) return <Button size="lg" variant="primary" className="mt-8 w-full" onClick={() => setOpen(true)}>Subscribe with PayPal</Button>

  return (
    <div className="mt-8 space-y-4 border-t-2 border-ink/10 pt-6 text-left">
      <p className="text-center text-sm font-semibold">Your details for delivery</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" value={form.given_name} onChange={(value) => update('given_name', value)} />
        <Field label="Last name" value={form.surname} onChange={(value) => update('surname', value)} />
      </div>
      <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} />
      <Field label="Full name for delivery" value={form.full_name} onChange={(value) => update('full_name', value)} />
      <Field label="Address" value={form.address_line_1} onChange={(value) => update('address_line_1', value)} />
      <Field label="Apartment / suite (optional)" value={form.address_line_2} onChange={(value) => update('address_line_2', value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City" value={form.admin_area_2} onChange={(value) => update('admin_area_2', value)} />
        <Field label="State / province" value={form.admin_area_1} onChange={(value) => update('admin_area_1', value)} />
        <Field label="Postal code" value={form.postal_code} onChange={(value) => update('postal_code', value)} />
        <Field label="Country code (AR, ES...)" value={form.country_code} maxLength={2} onChange={(value) => update('country_code', value.toUpperCase())} />
      </div>
      <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'subscription', vault: true }}>
        <PayPalButtons
          disabled={!valid(form)}
          forceReRender={[form, plan]}
          style={{ layout: 'vertical', label: 'subscribe' }}
          createSubscription={async () => {
            setError(null)
            const response = await fetch('/api/paypal/subscriptions', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, customer: { email: form.email, given_name: form.given_name, surname: form.surname }, shipping: { full_name: form.full_name, address_line_1: form.address_line_1, address_line_2: form.address_line_2, admin_area_2: form.admin_area_2, admin_area_1: form.admin_area_1, postal_code: form.postal_code, country_code: form.country_code } }),
            })
            if (!response.ok) {
              setError('We could not start PayPal. Please try again.')
              throw new Error('Could not create PayPal subscription')
            }
            return (await response.json() as { id: string }).id
          }}
          onApprove={async () => { router.push('/gracias?tipo=suscripcion') }}
          onError={() => setError('PayPal could not complete the request. Please try again.')}
        />
      </PayPalScriptProvider>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <button type="button" className="w-full text-center text-xs underline" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number }) {
  return <label className="block text-xs font-medium">{label}<input required type={type} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
}
