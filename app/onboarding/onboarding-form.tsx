'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'

const errorMessages: Record<string, string> = {
  missing_fields: 'Completá los dos campos para seguir.',
  save_failed: 'Algo falló al guardar. Probá de nuevo.',
}

export function OnboardingForm({
  action,
  defaultName,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>
  defaultName: string
  error?: string
}) {
  const [, formAction, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData)
    return null
  }, null)

  return (
    <form action={formAction} className="mt-8 space-y-5 rounded-2xl border-2 border-ink/10 bg-card p-7">
      {error && errorMessages[error] && (
        <p className="rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {errorMessages[error]}
        </p>
      )}

      <div>
        <label htmlFor="name" className="text-sm font-semibold text-ink">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          placeholder="Tu nombre"
          className="mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-collage-blue"
        />
      </div>

      <div>
        <label htmlFor="location" className="text-sm font-semibold text-ink">
          Ubicación
        </label>
        <input
          id="location"
          name="location"
          type="text"
          required
          placeholder="Ciudad, país"
          className="mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-collage-blue"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Guardando…' : 'Listo'}
      </Button>
    </form>
  )
}
