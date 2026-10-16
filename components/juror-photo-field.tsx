'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { downscaleImage } from '@/lib/downscale-image'
import { JUROR_PHOTO_BUCKET, JUROR_PHOTO_MAX_BYTES, JUROR_PHOTO_MAX_DIMENSION, JUROR_PHOTO_TYPES, jurorPhotoUrl } from '@/lib/juror-profile'

export type PrepareJurorPhotoUpload = (type: string) => Promise<{ path: string; token: string } | { error: string }>

const failed = 'No se pudo subir la foto. Probá de nuevo.'

// The photo of a juror profile form. The picked photo is shrunk in the
// browser and uploaded straight to Storage with a signed URL the server
// hands out for this juror (prepareUpload), so it never goes through a
// Function. The form saves its path with the rest of the profile
// (parseJurorPhoto); while it's uploading, the guard input holds the submit
// so the form can't be saved with the old photo.
export function JurorPhotoField({ id, initialPath, prepareUpload }: { id: string; initialPath: string | null; prepareUpload: PrepareJurorPhotoUpload }) {
  const [path, setPath] = useState(initialPath ?? '')
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guard = useRef<HTMLInputElement>(null)

  useEffect(() => {
    guard.current?.setCustomValidity(uploading ? 'Esperá a que termine de subir la foto.' : '')
  }, [uploading])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    setError(null)
    if (!JUROR_PHOTO_TYPES.includes(picked.type)) {
      setError('Tiene que ser una foto JPG, PNG o WEBP.')
      return
    }
    setUploading(true)
    try {
      const file = await downscaleImage(picked, JUROR_PHOTO_MAX_DIMENSION)
      if (file.size > JUROR_PHOTO_MAX_BYTES) {
        setError('La foto pesa más de 5MB: probá con otra.')
        return
      }
      const ticket = await prepareUpload(file.type)
      if ('error' in ticket) {
        setError(ticket.error)
        return
      }
      const { error: uploadError } = await createClient().storage.from(JUROR_PHOTO_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type })
      if (uploadError) {
        setError(failed)
        return
      }
      setPreview(URL.createObjectURL(file))
      setPath(ticket.path)
    } catch {
      setError(failed)
    } finally {
      setUploading(false)
    }
  }

  function remove() {
    setPath('')
    setPreview(null)
  }

  const src = preview ?? (path ? jurorPhotoUrl(path) : null)
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">Foto <span className="font-normal text-muted-foreground">(opcional) · Un retrato con la cara bien visible.</span></label>
      <div className="mt-2 flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-ink/10 bg-muted">
          {src
            ? <Image src={src} alt="" fill sizes="80px" unoptimized={Boolean(preview)} className="object-cover" />
            : <UserRound className="absolute inset-0 m-auto size-9 text-muted-foreground" aria-hidden />}
          {uploading && <div className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="size-5 animate-spin text-ink" aria-label="Subiendo" /></div>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink focus-within:border-collage-blue hover:border-ink/30">
            {uploading ? 'Subiendo…' : path ? 'Cambiar foto' : 'Subir foto'}
            <input id={id} type="file" accept={JUROR_PHOTO_TYPES.join(',')} onChange={handleFile} disabled={uploading} className="absolute inset-0 cursor-pointer opacity-0" />
          </span>
          {path && !uploading && <button type="button" onClick={remove} className="text-sm font-semibold text-muted-foreground underline hover:text-ink">Quitar</button>}
        </div>
      </div>
      <input type="hidden" name="photo_path" value={path} />
      <input ref={guard} tabIndex={-1} aria-hidden className="sr-only" />
      {error && <p role="alert" className="mt-2 text-sm text-collage-red">{error}</p>}
    </div>
  )
}
