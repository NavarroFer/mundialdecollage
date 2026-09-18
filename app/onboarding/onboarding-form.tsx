'use client'

import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'

const errorMessages: Record<string, string> = {
  missing_fields: 'Completá nombre, país y título de la obra para seguir.',
  missing_image: 'Subí una imagen de tu obra para seguir.',
  invalid_image: 'El archivo tiene que ser una imagen (JPG, PNG, WEBP o GIF).',
  image_too_large: 'La imagen pesa más de 15MB — probá con una versión más liviana.',
  invalid_instagram: 'Ese usuario de Instagram no parece válido — probá solo con el @usuario.',
  invalid_website: 'Ese sitio web no parece una URL válida (tiene que empezar con http:// o https://).',
  upload_failed: 'Algo falló al subir la imagen. Probá de nuevo.',
  save_failed: 'Algo falló al guardar. Probá de nuevo.',
}

const inputClass =
  'mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-collage-blue'

export function OnboardingForm({
  action,
  defaultName,
  userId,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>
  defaultName: string
  userId: string
  error?: string
}) {
  const [, formAction, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData)
    return null
  }, null)
  const [uploading, setUploading] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const countries = useMemo(
    () =>
      getAllCountryCodes()
        .map((code) => ({ code, name: countryCodeToName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setClientError(null)

    const formData = new FormData(event.currentTarget)
    const image = formData.get('artwork_image')

    if (!(image instanceof File) || image.size === 0) {
      setClientError(errorMessages.missing_image)
      return
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      setClientError(errorMessages.invalid_image)
      return
    }
    if (image.size > MAX_IMAGE_BYTES) {
      setClientError(errorMessages.image_too_large)
      return
    }

    setUploading(true)
    // Uploaded straight to Storage from the browser — a Server Action's
    // request body is capped by Vercel at ~4.5MB, well under photos people
    // actually submit, and the raw 413 that comes back crashes the page
    // instead of showing a clean error.
    const supabase = createClient()
    const extension = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('artworks')
      .upload(path, image, { contentType: image.type })
    setUploading(false)

    if (uploadError) {
      setClientError(errorMessages.upload_failed)
      return
    }

    formData.delete('artwork_image')
    formData.set('artwork_image_path', path)
    formAction(formData)
  }

  const displayError = clientError ?? (error && errorMessages[error])

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-5 rounded-2xl border-2 border-ink/10 bg-card p-7"
    >
      {displayError && (
        <p className="rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {displayError}
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
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="country_code" className="text-sm font-semibold text-ink">
          País
        </label>
        <select id="country_code" name="country_code" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Elegí tu país
          </option>
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="technique" className="text-sm font-semibold text-ink">
          Técnica <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="technique"
          name="technique"
          type="text"
          placeholder="Collage analógico, fotomontaje..."
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="artwork_title" className="text-sm font-semibold text-ink">
          Título de la obra
        </label>
        <input
          id="artwork_title"
          name="artwork_title"
          type="text"
          required
          placeholder="Nombre de tu collage"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="artwork_image" className="text-sm font-semibold text-ink">
          Imagen de la obra
        </label>
        <input
          id="artwork_image"
          name="artwork_image"
          type="file"
          accept="image/*"
          required
          className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-collage-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
        />
      </div>

      <div>
        <label htmlFor="instagram" className="text-sm font-semibold text-ink">
          Instagram <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="instagram"
          name="instagram"
          type="text"
          placeholder="@tu.usuario"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="website" className="text-sm font-semibold text-ink">
          Sitio web <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="website"
          name="website"
          type="url"
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <Button type="submit" size="lg" disabled={uploading || pending} className="w-full">
        {uploading ? 'Subiendo imagen…' : pending ? 'Enviando…' : 'Enviar mi obra'}
      </Button>
    </form>
  )
}
