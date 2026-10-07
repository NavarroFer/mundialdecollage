'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateSubmissionTitle } from '@/app/[locale]/(site)/admin/obras/actions'
import type { Submission } from './submission-types'

export function ArtworkTitleForm({ item }: { item: Submission }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.artworkTitle ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!open) return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" size="sm" onClick={() => {
      setTitle(item.artworkTitle ?? '')
      setError(null)
      setSaved(false)
      setOpen(true)
    }}><Pencil className="h-4 w-4" />Editar nombre</Button>
    {saved && <span role="status" className="text-xs font-semibold text-collage-blue">Nombre guardado.</span>}
  </div>

  return <form className="space-y-3 rounded-xl border-2 border-ink/10 p-4" onSubmit={event => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateSubmissionTitle(item.id, title)
        if (result.error) { setError(result.error); return }
        setSaved(true)
        setOpen(false)
      } catch {
        setError('No se pudo guardar el nombre. Probá de nuevo.')
      }
    })
  }}>
    <label className="block text-xs font-semibold text-ink">
      Nombre de la obra
      <input autoFocus value={title} onChange={event => setTitle(event.target.value)} disabled={pending}
        placeholder="Escribí el nombre de la obra"
        className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm outline-none focus:border-collage-blue" />
    </label>
    {error && <p role="alert" className="text-xs font-semibold text-collage-red">{error}</p>}
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? 'Guardando…' : 'Guardar nombre'}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  </form>
}
