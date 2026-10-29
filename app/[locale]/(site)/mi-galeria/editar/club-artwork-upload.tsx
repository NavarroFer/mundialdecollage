'use client'

import { useMemo, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountrySelect } from '@/components/ui/country-select'
import { createClient } from '@/lib/supabase/client'
import { downscaleImage } from '@/lib/downscale-image'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'
import { countryCodeToName, getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { addClubArtwork } from './actions'

export type ClubArtworkUploadTexts = {
  image: string
  title: string
  technique: string
  techniqueNone: string
  techniques: Record<string, string>
  optional: string
  profile: string
  name: string
  country: string
  upload: string
  uploading: string
  errorImage: string
  errorUpload: string
}

const inputClass = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'

// The photo goes from the browser straight to Storage, in the member's own
// folder, as in onboarding-form.tsx: a Server Action's body is capped by
// Vercel well under a phone photo. The action then only gets its path.
export function ClubArtworkUpload({ userId, locale, needsProfile, defaultName, texts }: {
  userId: string
  locale: string
  needsProfile: boolean
  defaultName: string
  texts: ClubArtworkUploadTexts
}) {
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const countries = useMemo(
    () => getAllCountryCodes()
      .map((code) => ({ code, name: countryCodeToName(code, locale) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [locale],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const image = formData.get('image')
    if (!(image instanceof File) || !image.size || !ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES) {
      setError(texts.errorImage)
      return
    }
    setUploading(true)
    try {
      const upload = await downscaleImage(image)
      const extension = upload.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/club-${Date.now()}.${extension}`
      const { error: uploadError } = await createClient().storage.from('artworks').upload(path, upload, { contentType: upload.type })
      if (uploadError) {
        setError(texts.errorUpload)
        return
      }
      formData.delete('image')
      formData.set('image_path', path)
      startTransition(() => addClubArtwork(formData))
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || pending
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {needsProfile && (
        <fieldset className="space-y-3 rounded-xl border-2 border-ink/10 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">{texts.profile}</legend>
          <div>
            <label htmlFor="club-name" className="text-sm font-semibold text-ink">{texts.name}</label>
            <input id="club-name" name="name" required maxLength={120} defaultValue={defaultName} className={inputClass} />
          </div>
          <div>
            <label htmlFor="club-country" className="text-sm font-semibold text-ink">{texts.country}</label>
            <CountrySelect id="club-country" name="country_code" countries={countries} required />
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor="club-image" className="text-sm font-semibold text-ink">{texts.image}</label>
        <input id="club-image" name="image" type="file" required accept={[...ALLOWED_IMAGE_TYPES].join(',')} className={inputClass} />
      </div>
      <div>
        <label htmlFor="club-title" className="text-sm font-semibold text-ink">
          {texts.title} <span className="font-normal text-muted-foreground">{texts.optional}</span>
        </label>
        <input id="club-title" name="title" maxLength={200} className={inputClass} />
      </div>
      <div>
        <label htmlFor="club-technique" className="text-sm font-semibold text-ink">
          {texts.technique} <span className="font-normal text-muted-foreground">{texts.optional}</span>
        </label>
        <select id="club-technique" name="technique" defaultValue="" className={inputClass}>
          <option value="">{texts.techniqueNone}</option>
          {TECHNIQUES.map((technique) => <option key={technique} value={technique}>{texts.techniques[technique] ?? technique}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">{error}</p>}
      <Button type="submit" disabled={busy} className="min-h-11 w-full">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{texts.uploading}</> : texts.upload}
      </Button>
    </form>
  )
}
