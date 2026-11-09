'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountrySelect } from '@/components/ui/country-select'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { TermsCheckbox } from '@/components/terms-checkbox'
import { countryCodeToName, getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { instagramHandle } from '@/lib/instagram'
import { confirmArtistDetails } from './actions'
import { useI18n } from '@/lib/i18n/client'

// Everything the artist can correct is open from the start: a misspelled name
// is the first thing they'd want to fix, and hiding it behind a button meant
// most never saw it. Only the email is fixed — it's the account's.
const inputClass = 'mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5'

export function ArtistConfirmation({ name, countryCode, email, instagram, website, artwork, artworkCount = 1 }: {
  name: string
  countryCode: string
  email: string
  instagram?: string | null
  website?: string | null
  artwork: { id: string; title: string | null; image_url: string; technique?: string | null }
  // More than one obra on the account: offer to choose among them.
  artworkCount?: number
}) {
  const [editedName, setEditedName] = useState(name)
  const [editedTitle, setEditedTitle] = useState(artwork.title ?? '')
  const handle = instagramHandle(instagram)
  const [error, action, pending] = useActionState(confirmArtistDetails, '')
  const { locale, m } = useI18n()
  const countries = useMemo(
    () =>
      getAllCountryCodes()
        .map((code) => ({ code, name: countryCodeToName(code, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [locale],
  )

  return (
    <form action={action} className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card shadow-sm">
      <input type="hidden" name="artwork_id" value={artwork.id} />
      <div className="relative aspect-[4/3] bg-paper">
        <Image src={artwork.image_url} alt={artwork.title ?? m.common.untitled} fill sizes="(max-width: 640px) 100vw, 512px" className="object-contain p-4" priority />
      </div>
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-collage-blue"><CheckCircle2 className="size-4" aria-hidden="true" />{m.confirmation.haveArtwork}</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">{artwork.title ?? m.common.untitled}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{m.confirmation.noReupload}</p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">{m.confirmation.yourDetails}</h3>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="artwork-title" className="text-sm font-medium">{m.confirmation.artworkTitle}</label>
              <input id="artwork-title" name="title" value={editedTitle} onChange={event => setEditedTitle(event.target.value)} required maxLength={200} className={inputClass} />
              {!artwork.title && <p className="mt-2 text-sm text-muted-foreground">{m.confirmation.titleMissing}</p>}
            </div>
            <div>
              <label htmlFor="artwork-technique" className="text-sm font-medium">{m.onboarding.technique} <span className="font-normal text-muted-foreground">{m.common.optional}</span></label>
              <select id="artwork-technique" name="technique" defaultValue={artwork.technique ?? ''} className={inputClass}>
                <option value="">{m.onboarding.techniqueNone}</option>
                {TECHNIQUES.map(technique => <option key={technique} value={technique}>{m.common.techniques[technique] ?? technique}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="artist-name" className="text-sm font-medium">{m.confirmation.artistName}</label>
              <input id="artist-name" name="name" value={editedName} onChange={event => setEditedName(event.target.value)} required maxLength={120} autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="artist-country" className="text-sm font-medium">{m.onboarding.country}</label>
              <CountrySelect id="artist-country" name="country_code" countries={countries} defaultValue={countryCode} required />
              {!countryCode && <p className="mt-2 text-sm text-muted-foreground">{m.confirmation.countryMissing}</p>}
            </div>
            <div>
              <label htmlFor="artist-instagram" className="text-sm font-medium">Instagram <span className="font-normal text-muted-foreground">{m.common.optional}</span></label>
              <input id="artist-instagram" name="instagram" defaultValue={handle ? `@${handle}` : ''} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={m.onboarding.instagramPlaceholder} className={inputClass} />
            </div>
            <div>
              <label htmlFor="artist-website" className="text-sm font-medium">{m.common.website} <span className="font-normal text-muted-foreground">{m.common.optional}</span></label>
              <input id="artist-website" name="website" type="text" inputMode="url" defaultValue={website ?? ''} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://..." className={inputClass} />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{m.onboarding.accountEmail}</p>
          <p className="break-all text-sm font-medium">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{m.confirmation.emailUse}</p>
        </div>
        <TermsCheckbox id="accept_terms_confirmation" />
        {error && <p role="alert" className="rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red-ink">{m.confirmation.errors[error] ?? m.onboarding.errors[error] ?? error}</p>}
        <Button type="submit" size="lg" disabled={pending} className="h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-center">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? m.common.confirming : m.confirmation.confirm}
        </Button>
        <div className="border-t border-ink/10 pt-4 text-sm text-muted-foreground">
          <p>{m.confirmation.notThisOne}</p>
          <div className="flex flex-wrap gap-x-5">
            {artworkCount > 1 && <Link href="/onboarding/obras" className="inline-flex min-h-11 items-center font-semibold text-collage-blue underline underline-offset-4">{m.entries.chooseAmong}</Link>}
            <Link href="/onboarding?another=1" className="inline-flex min-h-11 items-center font-semibold text-collage-blue underline underline-offset-4">{m.common.sendAnother}</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>{m.confirmation.otherAccount}</span><SignOutButton /></div>
        </div>
      </div>
    </form>
  )
}
