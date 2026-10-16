'use client'

import { useActionState, useId, useState, useSyncExternalStore } from 'react'
import { Loader2 } from 'lucide-react'
import { startDonation, type DonationState } from '@/app/[locale]/(site)/donar/actions'
import { DONATION_LIMITS, donationCurrencyFor, type DonationCurrency, type DonationOrigin } from '@/lib/donations'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// Each part's classes, so the same form fits the site and the gallery's themes.
export type DonationFormLook = { amount: string; input: string; submit: string; muted: string; link: string }

const SITE_LOOK: DonationFormLook = {
  amount: 'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-card px-2 font-display text-lg tracking-tight text-ink transition-colors hover:bg-collage-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60 sm:text-xl',
  input: 'min-h-11 w-full min-w-0 rounded-lg border-2 border-ink/15 bg-background px-4 py-2 text-sm',
  submit: 'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-collage-red px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60',
  muted: 'text-muted-foreground',
  link: 'font-semibold text-ink underline underline-offset-2 hover:text-collage-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60',
}

const PROVIDER_NAMES: Record<DonationCurrency, string> = { ARS: 'Mercado Pago', USD: 'PayPal' }

// PayPal's public id is set when it's set up (the store's buttons use it);
// without it, pesos only.
const PAYPAL_READY = Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)

const initial: DonationState = { error: null }

// The device's time zone never changes while the page is open. The static
// HTML says pesos; a device set abroad switches to dollars once hydrated.
const noSubscription = () => () => {}
const deviceCurrency = () => donationCurrencyFor(Intl.DateTimeFormat().resolvedOptions().timeZone)
const serverCurrency = (): DonationCurrency => 'ARS'

// The amounts to donate (lib/donations.ts), in pesos with Mercado Pago or in
// dollars with PayPal, whichever fits where the device is (the donor can
// switch). Each button goes straight to the provider; «Otro monto» is a form
// of its own, so Enter in its field doesn't press the first button.
export function DonationForm({ origin, look = SITE_LOOK, className }: { origin: DonationOrigin; look?: DonationFormLook; className?: string }) {
  const { locale, m } = useI18n()
  const t = m.donate
  const [state, action, pending] = useActionState(startDonation, initial)
  const guessed = useSyncExternalStore(noSubscription, deviceCurrency, serverCurrency)
  const [picked, setPicked] = useState<DonationCurrency | null>(null)
  const currency = PAYPAL_READY ? picked ?? guessed : 'ARS'
  const { amounts, min, max } = DONATION_LIMITS[currency]
  const provider = PROVIDER_NAMES[currency]
  // Which button is opening the checkout, to spin only that one.
  const [chosen, setChosen] = useState<string | null>(null)
  const amountsId = useId()
  const otherId = useId()
  const money = (amount: number) => formatMoney(locale, amount, currency)
  const spinner = (key: string) => pending && chosen === key && <Loader2 className="size-4 animate-spin" aria-hidden="true" />
  const hidden = (
    <>
      <input type="hidden" name="from" value={origin} />
      <input type="hidden" name="currency" value={currency} />
    </>
  )

  return (
    <div className={className}>
      <form action={action}>
        {hidden}
        <p id={amountsId} className={cn('text-xs font-bold tracking-[0.15em] uppercase', look.muted)}>{t.amounts}</p>
        <div role="group" aria-labelledby={amountsId} className="mt-2 grid grid-cols-3 gap-2">
          {amounts.map((amount) => (
            <button key={amount} type="submit" name="amount" value={amount} disabled={pending} onClick={() => setChosen(String(amount))} className={look.amount}>
              {spinner(String(amount))}
              {money(amount)}
            </button>
          ))}
        </div>
      </form>
      <form action={action} onSubmit={() => setChosen('other')} className="mt-2 flex gap-2">
        {hidden}
        <label htmlFor={otherId} className="sr-only">{t.other}</label>
        <input
          id={otherId}
          name="amount"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          required
          placeholder={t.other}
          className={look.input}
        />
        <button type="submit" disabled={pending} className={look.submit}>
          {spinner('other')}
          {t.submit}
        </button>
      </form>
      <p role="status" className="mt-2 text-sm font-semibold empty:hidden">{pending ? fmt(t.redirecting, { provider }) : ''}</p>
      {state.error && !pending && state.currency === currency && (
        <p role="alert" className="mt-2 text-sm font-semibold text-collage-red">
          {state.error === 'invalid' ? fmt(t.invalid, { min: money(min), max: money(max) }) : fmt(t.unavailable, { provider })}
        </p>
      )}
      <p className={cn('mt-2 text-xs', look.muted)}>{currency === 'ARS' ? t.note : t.noteUsd}</p>
      {PAYPAL_READY && (
        <p className="mt-3 text-sm">
          <span className={look.muted}>{currency === 'ARS' ? t.abroad : t.inArgentina}</span>{' '}
          <button type="button" disabled={pending} onClick={() => setPicked(currency === 'ARS' ? 'USD' : 'ARS')} className={look.link}>
            {currency === 'ARS' ? t.payUsd : t.payArs}
          </button>
        </p>
      )}
    </div>
  )
}
