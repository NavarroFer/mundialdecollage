'use client'

import { startTransition, useActionState, useMemo, useState } from 'react'
import Image from 'next/image'
import { Loader2, Plus, X } from 'lucide-react'
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
  maxArtworks = 1,
  another = false,
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
  // Shown before uploading: several obras can be sent, one takes part for
  // free (see lib/entries.ts).
  entriesNote?: boolean
  // How many obras this submission can add (site.entries.maxStored minus
  // the ones already on the account).
  maxArtworks?: number
  // Uploading more obras to an account that already has some (?another=1).
  another?: boolean
}) {
  const [, formAction, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData)
    return null
  }, null)
  const [uploading, setUploading] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  // One entry per obra in the form. The first one can fall back to the
  // prefilled image; the rest always need a file.
  const [slots, setSlots] = useState<{ key: number; pickedFileName: string | null }[]>([
    { key: 0, pickedFileName: null },
  ])
  const [nextKey, setNextKey] = useState(1)
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
    const images = formData.getAll('artwork_image')
    const hasFile = (image: FormDataEntryValue): image is File => image instanceof File && image.size > 0

    // Check every obra before uploading any, so a bad third file doesn't
    // leave the first two uploaded for nothing.
    for (const [index, image] of images.entries()) {
      if (!hasFile(image)) {
        // No new file picked — only the first obra can fall back to the
        // image page.tsx already fetched from Drive for this person.
        if (index === 0 && hasImagePrefill) continue
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
    }

    setUploading(true)
    // Uploaded straight to Storage from the browser — a Server Action's
    // request body is capped by Vercel at ~4.5MB, well under photos people
    // actually submit, and the raw 413 that comes back crashes the page
    // instead of showing a clean error.
    const supabase = createClient()
    const paths: string[] = []
    for (const [index, image] of images.entries()) {
      if (!hasFile(image)) {
        paths.push(prefillImagePath!)
        continue
      }
      const extension = image.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}-${index}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(path, image, { contentType: image.type })
      if (uploadError) {
        setUploading(false)
        setClientError(errorMessages.upload_failed)
        return
      }
      paths.push(path)
    }
    setUploading(false)

    formData.delete('artwork_image')
    for (const path of paths) formData.append('artwork_image_path', path)
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

      {another && <input type="hidden" name="another" value="1" />}

      {entriesNote && (
        <p className="rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 text-sm text-ink">
          {fmt(m.entries.onboardingNote, {
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

      {slots.map((slot, index) => {
        const canUsePrefill = index === 0 && hasImagePrefill
        const id = (field: string) => `${field}-${slot.key}`
        return (
          <fieldset key={slot.key} className="space-y-4 rounded-xl border-2 border-ink/10 p-4">
            <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-bold text-ink">
              <span>{fmt(m.entries.artworkNumber, { number: index + 1 })}</span>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSlots((previous) => previous.filter((other) => other.key !== slot.key))}
                  className="flex min-h-11 items-center gap-1 text-sm font-semibold text-collage-red"
                >
                  <X className="size-4" aria-hidden="true" />
                  {m.entries.removeArtwork}
                </button>
              )}
            </legend>

            <div>
              <label htmlFor={id('artwork_title')} className="text-sm font-semibold text-ink">
                {m.onboarding.artworkTitle}
              </label>
              <input
                id={id('artwork_title')}
                name="artwork_title"
                type="text"
                required
                placeholder={m.onboarding.artworkTitlePlaceholder}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={id('technique')} className="text-sm font-semibold text-ink">
                {m.onboarding.technique} <span className="font-normal text-muted-foreground">{m.common.optional}</span>
              </label>
              <select id={id('technique')} name="technique" defaultValue="" className={inputClass}>
                <option value="">{m.onboarding.techniqueNone}</option>
                {TECHNIQUES.map((technique) => (
                  <option key={technique} value={technique}>
                    {m.common.techniques[technique] ?? technique}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={id('artwork_image')} className="text-sm font-semibold text-ink">
                {canUsePrefill ? `${m.onboarding.changeImage} ${m.common.optional}` : m.onboarding.artworkImage}
              </label>

              {canUsePrefill && !slot.pickedFileName && !hasLegacyMatch && (
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
                id={id('artwork_image')}
                name="artwork_image"
                type="file"
                accept="image/*"
                required={!canUsePrefill}
                onChange={(event) => {
                  const pickedFileName = event.target.files?.[0]?.name ?? null
                  setSlots((previous) =>
                    previous.map((other) => (other.key === slot.key ? { ...other, pickedFileName } : other)),
                  )
                }}
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-collage-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground`}
              />
            </div>
          </fieldset>
        )
      })}

      {slots.length < maxArtworks && (
        <button
          type="button"
          onClick={() => {
            setSlots((previous) => [...previous, { key: nextKey, pickedFileName: null }])
            setNextKey((key) => key + 1)
          }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-collage-blue/40 text-sm font-semibold text-collage-blue hover:bg-collage-blue/5"
        >
          <Plus className="size-4" aria-hidden="true" />
          {m.entries.addArtwork}
        </button>
      )}

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
