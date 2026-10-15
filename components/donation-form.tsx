'use client'

import { useActionState, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { startDonation, type DonationState } from '@/app/[locale]/(site)/donar/actions'
import { DONATION_AMOUNTS_ARS, DONATION_MAX_ARS, DONATION_MIN_ARS, type DonationOrigin } from '@/lib/donations'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// Each part's classes, so the same form fits the site and the gallery's themes.
export type DonationFormLook = { amount: string; input: string; submit: string; muted: string }

const SITE_LOOK: DonationFormLook = {
  amount: 'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-card px-2 font-display text-lg tracking-tight text-ink transition-colors hover:bg-collage-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60 sm:text-xl',
  input: 'min-h-11 w-full min-w-0 rounded-lg border-2 border-ink/15 bg-background px-4 py-2 text-sm',
  submit: 'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-collage-red px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60',
  muted: 'text-muted-foreground',
}

const initial: DonationState = { error: null }

// The amounts to donate (lib/donations.ts). Each button goes straight to
// Mercado Pago; «Otro monto» is a form of its own, so Enter in its field
// doesn't press the first button.
export function DonationForm({ origin, look = SITE_LOOK, className }: { origin: DonationOrigin; look?: DonationFormLook; className?: string }) {
  const { locale, m } = useI18n()
  const t = m.donate
  const [state, action, pending] = useActionState(startDonation, initial)
  // Which button is opening Mercado Pago, to spin only that one.
  const [chosen, setChosen] = useState<string | null>(null)
  const amountsId = useId()
  const otherId = useId()
  const ars = (amount: number) => formatMoney(locale, amount, 'ARS')
  const spinner = (key: string) => pending && chosen === key && <Loader2 className="size-4 animate-spin" aria-hidden="true" />

  return (
    <div className={className}>
      <form action={action}>
        <input type="hidden" name="from" value={origin} />
        <p id={amountsId} className={cn('text-xs font-bold tracking-[0.15em] uppercase', look.muted)}>{t.amounts}</p>
        <div role="group" aria-labelledby={amountsId} className="mt-2 grid grid-cols-3 gap-2">
          {DONATION_AMOUNTS_ARS.map((amount) => (
            <button key={amount} type="submit" name="amount" value={amount} disabled={pending} onClick={() => setChosen(String(amount))} className={look.amount}>
              {spinner(String(amount))}
              {ars(amount)}
            </button>
          ))}
        </div>
      </form>
      <form action={action} onSubmit={() => setChosen('other')} className="mt-2 flex gap-2">
        <input type="hidden" name="from" value={origin} />
        <label htmlFor={otherId} className="sr-only">{t.other}</label>
        <input
          id={otherId}
          name="amount"
          type="number"
          inputMode="numeric"
          min={DONATION_MIN_ARS}
          max={DONATION_MAX_ARS}
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
      <p role="status" className="mt-2 text-sm font-semibold empty:hidden">{pending ? t.redirecting : ''}</p>
      {state.error && !pending && (
        <p role="alert" className="mt-2 text-sm font-semibold text-collage-red">
          {state.error === 'invalid' ? fmt(t.invalid, { min: ars(DONATION_MIN_ARS), max: ars(DONATION_MAX_ARS) }) : t.unavailable}
        </p>
      )}
      <p className={cn('mt-2 text-xs', look.muted)}>{t.note}</p>
    </div>
  )
}
