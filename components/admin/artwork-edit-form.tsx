'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pencil, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'
import { updateArtwork } from '@/app/admin/obras/actions'
import { Button } from '@/components/ui/button'
import type { Submission } from '@/components/admin/submission-types'

const inputClass =
  'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm outline-none focus:border-collage-blue'

// Edits an already-loaded artworks row — including one that's already public —
// from inside the viewer. The replacement photo goes straight to Storage from
// the browser (same reason as legacy-image-upload.tsx: a Server Action's body
// is capped well under what a phone photo can weigh), under a new path each
// time so the public URL changes and no cache keeps serving the old image.
export function ArtworkEditForm({ item }: { item: Submission }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.artworkTitle ?? '')
  const [technique, setTechnique] = useState(item.technique ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = uploading || isPending

  function reset() {
    setTitle(item.artworkTitle ?? '')
    setTechnique(item.technique ?? '')
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setError(null)
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    setError(null)
    if (!ALLOWED_IMAGE_TYPES.has(picked.type)) {
      setError('Tiene que ser una imagen (JPG, PNG, WEBP o GIF).')
      return
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setError('Pesa más de 15MB — probá con una versión más liviana.')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!item.artworkId) return
    setError(null)
    setSaved(false)

    let imagePath: string | undefined
    if (file) {
      setUploading(true)
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      imagePath = `admin/${item.artworkId}/${Date.now()}.${extension}`
      const { error: uploadError } = await createClient()
        .storage.from('artworks')
        .upload(imagePath, file, { contentType: file.type })
      setUploading(false)
      if (uploadError) {
        setError('Algo falló al subir la imagen. Probá de nuevo.')
        return
      }
    }

    const artworkId = item.artworkId
    startTransition(async () => {
      const result = await updateArtwork({ artworkId, title, technique, imagePath })
      if (result.error) {
        setError(result.error)
        return
      }
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setSaved(true)
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            reset()
            setSaved(false)
            setOpen(true)
          }}
        >
          <Pencil className="h-4 w-4" />
          Editar obra
        </Button>
        {saved && <span className="text-xs font-semibold text-collage-blue">Cambios guardados.</span>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border-2 border-ink/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-ink">
          Técnica
          <select value={technique} onChange={(e) => setTechnique(e.target.value)} className={inputClass}>
            <option value="">Sin especificar</option>
            <option value="Analógica">Analógica</option>
            <option value="Mixta">Mixta</option>
            <option value="Digital">Digital</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex items-center gap-1.5 text-sm font-semibold text-collage-blue hover:underline ${
            busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
          }`}
        >
          <Upload className="h-4 w-4" />
          {file ? 'Elegir otra imagen' : 'Cambiar imagen'}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={handleFile} />
        </label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not optimizable
          <img src={preview} alt="Nueva imagen" className="h-16 w-16 rounded-lg border border-ink/10 object-cover" />
        )}
      </div>

      {error && <p className="text-xs font-semibold text-collage-red">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? 'Subiendo imagen…' : isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
