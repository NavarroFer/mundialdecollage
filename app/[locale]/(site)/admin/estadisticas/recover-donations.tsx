'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/admin/submit-button'
import { recoverDonations, type RecoverDonationsState } from './actions'

const INITIAL: RecoverDonationsState = { found: null, error: false }

function outcome({ found, error }: RecoverDonationsState) {
  if (error) return 'No pudimos consultar Mercado Pago. Probá de nuevo en un rato.'
  if (found === null) return ''
  if (found === 0) return 'Mercado Pago no tiene donaciones desde el 15 de octubre.'
  return `Mercado Pago tiene ${found} ${found === 1 ? 'pago de donación' : 'pagos de donaciones'}: la lista ya está al día.`
}

export function RecoverDonations() {
  const [state, action] = useActionState(recoverDonations, INITIAL)
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton size="sm" variant="outline" pendingLabel="Buscando…">Buscar en Mercado Pago</SubmitButton>
      <p role="status" className={state.error ? 'text-xs text-collage-red' : 'text-xs text-muted-foreground'}>{outcome(state)}</p>
    </form>
  )
}
