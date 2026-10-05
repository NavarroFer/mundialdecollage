'use client'

import { useState, useTransition } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'
import { setLegacyImageManually } from '@/app/[locale]/(site)/admin/obras/actions'
import { downscaleImage } from '@/lib/downscale-image'

// Lets an admin pick a photo by hand for a legacy_submissions row whose
// Drive fetch keeps failing (private file, deleted, or a restriction the
// fixes in lib/legacy-submissions.ts still can't work around) — the admin
// downloads it from wherever they actually got it from the artist and
// uploads it here instead of being stuck on "Reintentar" forever.
//
// Uploads straight to Storage from the browser, same reason as
// onboarding-form.tsx: a Server Action's body is capped well under what a
// phone photo can weigh. Each upload gets its own timestamped path so
// replacing a wrong photo changes the public URL — overwriting in place kept
// the old image cached by the CDN and next/image.
export function LegacyImageUpload({ id }: { id: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const busy = uploading || isPending

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Tiene que ser una imagen (JPG, PNG, WEBP o GIF).')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Pesa más de 15MB — probá con una versión más liviana.')
      return
    }

    setUploading(true)
    const upload = await downscaleImage(file)
    const extension = upload.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `legacy/${id}-${Date.now()}.${extension}`
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('artworks')
      .upload(path, upload, { contentType: upload.type })
    setUploading(false)

    if (uploadError) {
      setError('Algo falló al subir la imagen. Probá de nuevo.')
      return
    }

    const formData = new FormData()
    formData.set('id', id)
    formData.set('path', path)
    startTransition(async () => {
      await setLegacyImageManually(formData)
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <label
        className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold text-collage-blue hover:underline ${
          busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Subir imagen
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={handleChange} />
      </label>
      {error && <span className="text-[0.65rem] font-semibold text-collage-red">{error}</span>}
    </span>
  )
}
