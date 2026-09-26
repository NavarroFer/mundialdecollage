'use client'

import { startTransition, useActionState, useMemo, useState } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { Button } from '@/components/ui/button'
import { CountrySelect } from '@/components/ui/country-select'
import { countryCodeToName, getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { site } from '@/lib/site'

const inputClass =
  'mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-collage-blue'

export function OnboardingForm({
  action,
  defaultName,
  defaultCountryCode,
  defaultInstagram = '',
  defaultWebsite = '',
  userId,
  error,
  hasLegacyMatch,
  email,
  prefillImageUrl,
  prefillImagePath,
  entriesNote,
}: {
  action: (formData: FormData) => void | Promise<void>
  defaultName: string
  defaultInstagram?: string
  defaultWebsite?: string
  // Best-effort guess from the legacy import's country_raw (or the artist's
  // own value on a resubmission) — see app/onboarding/page.tsx. Just the
  // CountrySelect's starting value, same as defaultName for the name field:
  // the artist can still change it before submitting.
  defaultCountryCode?: string
  userId: string
  error?: string
  // Set when app/onboarding/page.tsx found a curated legacy_submissions row
  // for this person (see supabase/migrations/20260919000000_legacy_
  // submissions.sql) — surfaces the "we found your obra" note even if the
  // image fetch itself failed and only the name came through.
  hasLegacyMatch?: boolean
  email?: string
  // Public URL of the artwork image page.tsx already fetched from Drive and
  // uploaded to Storage for this user, if that succeeded — shown as a
  // preview so they're not asked to re-upload what we already have.
  prefillImageUrl?: string
  // The Storage path backing prefillImageUrl — submitted as-is when the
  // artist doesn't pick a new file, so the server action treats it exactly
  // like a normal upload.
  prefillImagePath?: string
  // How many obras take part, told before uploading: 'first' for someone's
  // first obra, 'another' when they already have one (see lib/entries.ts).
  entriesNote?: 'first' | 'another'
}) {
  const [, formAction, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData)
    return null
  }, null)
  const [uploading, setUploading] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [pickedFileName, setPickedFileName] = useState<string | null>(null)
  const hasImagePrefill = Boolean(prefillImageUrl && prefillImagePath)
  const { locale, m } = useI18n()
  const errorMessages = m.onboarding.errors

  const countries = useMemo(
    () =>
      getAllCountryCodes()
        .map((code) => ({ code, name: countryCodeToName(code, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [locale],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setClientError(null)

    const formData = new FormData(event.currentTarget)
    const image = formData.get('artwork_image')

    if (image instanceof File && image.size > 0) {
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
      startTransition(() => formAction(formData))
      return
    }

    // No new file picked — fall back to the image page.tsx already fetched
    // from Drive and uploaded on this person's behalf, if there is one.
    if (!hasImagePrefill || !prefillImagePath) {
      setClientError(errorMessages.missing_image)
      return
    }
    formData.delete('artwork_image')
    formData.set('artwork_image_path', prefillImagePath)
    startTransition(() => formAction(formData))
  }

  const displayError = clientError ?? (error && errorMessages[error])

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-5 rounded-2xl border-2 border-ink/10 bg-card p-7"
    >
      {displayError && (
        <p role="alert" className="rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {displayError}
        </p>
      )}

      {hasLegacyMatch && (
        <div className="rounded-xl bg-collage-blue/5 p-4">
          <p className="font-semibold text-collage-blue">{m.onboarding.startedForYou}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasImagePrefill ? m.onboarding.legacyImageFound : m.onboarding.legacyImageMissing}
          </p>
          {hasImagePrefill && (
            <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-lg bg-paper">
              <Image src={prefillImageUrl!} alt={m.onboarding.legacyImageAlt} fill sizes="(max-width: 640px) 100vw, 448px" className="object-contain p-2" priority />
            </div>
          )}
        </div>
      )}

      {entriesNote && (
        <p className="rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 text-sm text-ink">
          {entriesNote === 'first'
            ? m.entries.onboardingFirst
            : fmt(m.entries.onboardingAnother, {
                limit: site.entries.paidLimit,
                ars: formatMoney(locale, site.entries.priceArs, 'ARS'),
                usd: formatMoney(locale, site.entries.priceUsd, 'USD'),
              })}
        </p>
      )}

      {email && (
        <div className="rounded-lg bg-paper p-3">
          <p className="text-sm text-muted-foreground">{m.onboarding.accountEmail}</p>
          <p className="break-all text-sm font-semibold">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{m.onboarding.emailNote}</p>
          <SignOutButton />
        </div>
      )}

      <div>
        <label htmlFor="name" className="text-sm font-semibold text-ink">
          {m.onboarding.name}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          placeholder={m.onboarding.namePlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="country_code" className="text-sm font-semibold text-ink">
          {m.onboarding.country}
        </label>
        <CountrySelect
          id="country_code"
          name="country_code"
          countries={countries}
          defaultValue={defaultCountryCode}
          required
        />
      </div>

      <div>
        <label htmlFor="technique" className="text-sm font-semibold text-ink">
          {m.onboarding.technique} <span className="font-normal text-muted-foreground">{m.common.optional}</span>
        </label>
        <select id="technique" name="technique" defaultValue="" className={inputClass}>
          <option value="">{m.onboarding.techniqueNone}</option>
          {TECHNIQUES.map((technique) => (
            <option key={technique} value={technique}>
              {m.common.techniques[technique] ?? technique}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="artwork_title" className="text-sm font-semibold text-ink">
          {m.onboarding.artworkTitle}
        </label>
        <input
          id="artwork_title"
          name="artwork_title"
          type="text"
          required
          placeholder={m.onboarding.artworkTitlePlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="artwork_image" className="text-sm font-semibold text-ink">
          {hasImagePrefill ? `${m.onboarding.changeImage} ${m.common.optional}` : m.onboarding.artworkImage}
        </label>

        {hasImagePrefill && !pickedFileName && !hasLegacyMatch && (
          <div className="mt-1.5 mb-2 flex items-center gap-3 rounded-lg border-2 border-collage-blue/20 bg-collage-blue/5 p-2.5">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-ink/10 bg-muted">
              <Image
                src={prefillImageUrl!}
                alt={m.onboarding.previousImageAlt}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {m.onboarding.previousImageNote}
            </p>
          </div>
        )}

        <input
          id="artwork_image"
          name="artwork_image"
          type="file"
          accept="image/*"
          required={!hasImagePrefill}
          onChange={(event) => setPickedFileName(event.target.files?.[0]?.name ?? null)}
          className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-collage-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
        />
      </div>

      <div>
        <label htmlFor="instagram" className="text-sm font-semibold text-ink">
          Instagram <span className="font-normal text-muted-foreground">{m.common.optional}</span>
        </label>
        <input
          defaultValue={defaultInstagram}
          id="instagram"
          name="instagram"
          type="text"
          placeholder={m.onboarding.instagramPlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="website" className="text-sm font-semibold text-ink">
          {m.common.website} <span className="font-normal text-muted-foreground">{m.common.optional}</span>
        </label>
        <input
          defaultValue={defaultWebsite}
          id="website"
          name="website"
          type="url"
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <Button type="submit" size="lg" disabled={uploading || pending} className="w-full">
        {uploading || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {uploading
          ? m.onboarding.uploading
          : pending
            ? m.common.confirming
            : hasLegacyMatch
              ? m.onboarding.confirmParticipation
              : m.onboarding.submit}
      </Button>
    </form>
  )
}
