'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'

const errorMessages: Record<string, string> = {
  not_configured: 'La inscripción todavía no está disponible.',
  invalid_payment_type: 'Elegí una forma de pago para continuar.',
  full: 'Se completaron los 20 cupos justo antes de tu pago.',
  missing_email: 'Tu cuenta de Google no tiene un email asociado — escribinos para resolverlo.',
  save_failed: 'Algo falló al guardar tu inscripción. Probá de nuevo.',
  mp_failed: 'No pudimos iniciar el pago. Probá de nuevo en un momento.',
  pago_fallido: 'El pago no se completó — podés intentarlo de nuevo.',
}

function formatArs(amount: number) {
  return `$${amount.toLocaleString('es-AR')}`
}

export function RegistrationForm({
  action,
  minDeposit,
  totalPrice,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>
  minDeposit: number
  totalPrice: number
  error?: string
}) {
  const [, formAction, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData)
    return null
  }, null)

  return (
    <form
      action={formAction}
      className="mt-8 space-y-5 rounded-2xl border-2 border-ink/10 bg-card p-7"
    >
      {error && errorMessages[error] && (
        <p className="rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {errorMessages[error]}
        </p>
      )}

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-ink/15 bg-background px-4 py-3 has-[:checked]:border-collage-blue">
          <input
            type="radio"
            name="payment_type"
            value="sena"
            defaultChecked
            className="h-4 w-4 accent-collage-blue"
          />
          <span className="text-sm font-semibold text-ink">
            Pagar la seña ({formatArs(minDeposit)})
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-ink/15 bg-background px-4 py-3 has-[:checked]:border-collage-blue">
          <input
            type="radio"
            name="payment_type"
            value="completo"
            className="h-4 w-4 accent-collage-blue"
          />
          <span className="text-sm font-semibold text-ink">
            Pagar el total ({formatArs(totalPrice)})
          </span>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Si pagás la seña, el resto lo abonás en efectivo el día del taller.
      </p>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Redirigiendo…' : 'Ir a pagar'}
      </Button>
    </form>
  )
}
