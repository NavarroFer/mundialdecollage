'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SubmitButton } from '@/components/admin/submit-button'
import type { Recovered } from '@/lib/payments/recover'
import { recoverPayments, type RecoverPaymentsState } from './actions'

const INITIAL: RecoverPaymentsState = { found: null, error: false }

const count = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`

/** «2 donaciones, 1 suscripción de la tienda con 1 cobro y 3 pagos de obras extra», leaving out what it didn't find. */
export function recoveredSummary(found: Recovered) {
  const parts = [
    found.donation > 0 && count(found.donation, 'donación', 'donaciones'),
    found.subscriptions > 0 &&
      `${count(found.subscriptions, 'suscripción de la tienda', 'suscripciones de la tienda')} con ${count(found.charges, 'cobro', 'cobros')}`,
    found.entry > 0 && count(found.entry, 'pago de obras extra', 'pagos de obras extra'),
    found.magazine > 0 && count(found.magazine, 'pedido de la revista', 'pedidos de la revista'),
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 0) return 'Mercado Pago no tiene pagos del Mundial para traer.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`
  return `Mercado Pago tiene ${list}: ya está todo al día.`
}

function outcome({ found, error }: RecoverPaymentsState) {
  if (error) return 'No pudimos consultar Mercado Pago. Probá de nuevo en un rato.'
  return found ? recoveredSummary(found) : ''
}

export function RecoverPayments() {
  const [state, action] = useActionState(recoverPayments, INITIAL)
  const router = useRouter()
  // The page behind is rendered per locale: bring its lists up to date here.
  useEffect(() => {
    if (state.found) router.refresh()
  }, [state.found, router])
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton size="sm" variant="outline" pendingLabel="Buscando…">Buscar en Mercado Pago</SubmitButton>
      <p role="status" className={state.error ? 'text-xs text-collage-red' : 'text-xs text-muted-foreground'}>{outcome(state)}</p>
    </form>
  )
}
