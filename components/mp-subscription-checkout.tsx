'use client'

import { useActionState, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startMpSubscription, type MpSubscriptionState } from '@/app/[locale]/(site)/tienda/actions'
import { CorreoBranchPicker, AddressForBranchFields, type AddressForBranch, type PickupSelection } from '@/components/correo-branch-picker'
import { MAGAZINE_FIELDS, type MagazineField } from '@/lib/magazine'
import { planById, storePlanName, type StorePlanId } from '@/lib/store'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { MpCardSubscriptionCheckout } from '@/components/mp-card-subscription-checkout'
import { FreeShippingBadge } from '@/components/free-shipping-badge'

const initial: MpSubscriptionState = { error: null, invalid: [], values: {} }

// `flatShippingFee`: the buyer types an address instead of picking a Correo
// branch (we choose the nearest one), at that monthly fee, while Correo's API
// credentials aren't set (lib/correo.ts).
export function MpSubscriptionCheckout({ plan, flatShippingFee }: { plan: StorePlanId; flatShippingFee?: number }) {
  const { m, locale } = useI18n()
  const t = m.store.mp
  const p = m.store.pickup
  const [step, setStep] = useState(0)
  const [pickerVersion, setPickerVersion] = useState(0)
  const [state, action, pending] = useActionState(async (previous: MpSubscriptionState, form: FormData) => {
    const outcome = await startMpSubscription(plan, previous, form)
    if (outcome.invalid.length) {
      const destinationInvalid = outcome.invalid.some((field) => ['branch_code', 'shipping_fee'].includes(field))
      setStep(destinationInvalid ? 0 : 1)
      if (destinationInvalid) setPickerVersion((version) => version + 1)
    }
    return outcome
  }, initial)
  const cardAvailable = Boolean(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY)
  const [method, setMethod] = useState<'card' | 'account'>(cardAvailable ? 'card' : 'account')
  const [shipping, setShipping] = useState<FormData | null>(null)
  const [cardResult, setCardResult] = useState<MpSubscriptionState | null>(null)
  const [pickup, setPickup] = useState<PickupSelection | null>(null)
  const [address, setAddress] = useState<AddressForBranch | null>(null)
  const byAddress = flatShippingFee !== undefined
  const destinationReady = byAddress ? address !== null : pickup !== null
  const shippingFee = byAddress ? flatShippingFee : pickup?.fee ?? 0
  const [gift, setGift] = useState(false)
  const [review, setReview] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const result = cardResult ?? state
  const money = (amount: number) => new Intl.NumberFormat(LOCALE_INFO[locale].intl, { style: 'currency', currency: 'ARS' }).format(amount)
  // Shipping is free to the buyer: it's already in the plan's price.
  const total = money(planById(plan)!.priceArs + shippingFee)
  const snapshot = (form: HTMLFormElement) => Object.fromEntries(Array.from(new FormData(form).entries()).map(([field, value]) => [field, String(value)]))

  if (shipping) return <MpCardSubscriptionCheckout plan={plan} shipping={shipping} onResult={setCardResult} onBack={() => {
    setCardResult((previous) => ({ ...previous, error: null, invalid: previous?.invalid ?? [], values: Object.fromEntries(MAGAZINE_FIELDS.map((field) => [field, String(shipping.get(field) ?? '')])) }))
    setShipping(null)
  }} />

  const field = (name: MagazineField, label: string, props: React.ComponentProps<'input'> = {}) => (
    <label className="block text-sm font-medium">
      {label}
      <input name={name} aria-invalid={result.invalid.includes(name) || undefined} {...props}
        defaultValue={result.values[name] ?? review[name] ?? props.defaultValue}
        className={cn('mt-1 min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground', result.invalid.includes(name) ? 'border-collage-red' : 'border-input')} />
    </label>
  )
  return (
    <form ref={formRef} action={action} onSubmit={(event) => {
      if (step < 2) {
        event.preventDefault()
        if (step === 0 && destinationReady) setStep(1)
        if (step === 1) { setReview(snapshot(event.currentTarget)); setStep(2) }
        return
      }
      if (!destinationReady) { event.preventDefault(); setStep(0); return }
      setCardResult(null)
      if (method === 'card') { event.preventDefault(); setShipping(new FormData(event.currentTarget)) }
    }} className="space-y-5 text-left">
      <ol aria-label={p.review} className="grid grid-cols-3 gap-2 border-b pb-4 text-xs sm:text-sm">
        {[byAddress ? p.addressTitle : p.title, t.details, p.review].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'font-semibold text-collage-blue' : 'text-muted-foreground'}>{i + 1}. {label}</li>)}
      </ol>
      <div className={step === 0 ? '' : 'hidden'}>
        {byAddress
          ? <AddressForBranchFields key={pickerVersion} fee={flatShippingFee} initial={{ ...review, ...result.values }} onChange={setAddress} />
          : <CorreoBranchPicker key={pickerVersion} plan={plan} initialProvince={result.values.province || review.province} initialCode={result.values.branch_code || review.branch_code} onChange={setPickup} />}
      </div>
      <div className={step === 1 ? 'space-y-3' : 'hidden'}>
        {field('name', t.name, { required: step > 0, autoComplete: 'name', maxLength: 120 })}
        {field('email', t.email, { required: step > 0, type: 'email', autoComplete: 'email', maxLength: 254 })}
        {field('phone', t.phone, { required: step > 0, type: 'tel', autoComplete: 'tel', maxLength: 30, placeholder: t.phonePlaceholder })}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} />{p.gift}</label>
        {gift && field('recipient_name', p.recipient, { required: step > 0, autoComplete: 'shipping name', maxLength: 120 })}
        {!gift && <input type="hidden" name="recipient_name" value="" />}
        <p className="text-xs text-muted-foreground">{p.identity}</p>
        <fieldset className="space-y-2 border-t pt-3">
          <legend className="text-sm font-semibold">{t.paymentMethod}</legend>
          {cardAvailable && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="payment_method" value="card" checked={method === 'card'} onChange={() => setMethod('card')} />{t.card.option}</label>}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="payment_method" value="account" checked={method === 'account'} onChange={() => setMethod('account')} />{t.accountOption}</label>
        </fieldset>
        {method === 'account' && <label className="block text-sm font-medium">{t.payerEmail}<input name="payer_email" defaultValue={review.payer_email} type="email" required={step > 0} autoComplete="email" maxLength={254} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><span className="mt-1 block text-xs text-muted-foreground">{t.payerEmailHelp}</span></label>}
      </div>
      {step === 2 && <section aria-label={p.review} className="space-y-3 rounded-xl border p-4">
        <p className="font-semibold">{p.review}</p>
        <p>{storePlanName(planById(plan)!, m.store)} · {total} {m.store.perMonth}</p>
        <FreeShippingBadge label={m.store.freeShipping} />
        {byAddress
          ? <p className="text-sm">{p.addressMode}: {address?.address}<br />{address?.city}, {address?.province}</p>
          : <p className="text-sm">{p.mode}: {pickup?.branch.name}<br />{pickup?.branch.address} · {pickup?.branch.locality || pickup?.branch.city}</p>}
        <p className="text-sm">{review.recipient_name || review.name}<br />{review.email} · {review.phone}</p>
        <p className="border-t pt-3 font-semibold">{p.total}: {total}</p>
        <p className="text-xs text-muted-foreground">{p.recurring}</p>
        <p className="text-xs text-muted-foreground">{p.readyHelp}</p>
      </section>}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {result.error && <p role="alert" className="text-sm text-collage-red">{(result.invalid.includes('branch_code') || result.invalid.includes('shipping_fee')) ? p.changed : t.errors[result.error]}</p>}
      {step > 0 && <button type="button" disabled={pending} onClick={() => { if (formRef.current) setReview(snapshot(formRef.current)); if (step === 1) setPickerVersion((version) => version + 1); setStep((n) => n - 1) }} className="min-h-11 w-full text-center text-sm underline">{p.back}</button>}
      <Button type="submit" size="lg" disabled={pending || !destinationReady} className="min-h-12 w-full">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {step < 2 ? p.next : method === 'card' ? t.card.continue : t.submit}
      </Button>
      {step === 2 && <p className="text-center text-xs text-muted-foreground">{method === 'card' ? t.card.description : t.redirect}</p>}
    </form>
  )
}
