'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountrySelect } from '@/components/ui/country-select'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { confirmArtistDetails } from './actions'
import { useI18n } from '@/lib/i18n/client'

export function ArtistConfirmation({ name, countryCode, email, artwork, artworkCount = 1 }: {
  name: string
  countryCode: string
  email: string
  artwork: { id: string; title: string | null; image_url: string }
  // More than one obra on the account: offer to choose among them.
  artworkCount?: number
}) {
  const [editedName, setEditedName] = useState(name)
  const [editedTitle, setEditedTitle] = useState(artwork.title ?? '')
  const [editing, setEditing] = useState(!name || !countryCode || !artwork.title)
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
          {editing ? (
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="artwork-title" className="text-sm font-medium">{m.confirmation.artworkTitle}</label>
                <input id="artwork-title" name="title" value={editedTitle} onChange={event => setEditedTitle(event.target.value)} required maxLength={200} className="mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5" />
                {!artwork.title && <p className="mt-2 text-sm text-muted-foreground">{m.confirmation.titleMissing}</p>}
              </div>
              <div>
                <label htmlFor="artist-name" className="text-sm font-medium">{m.confirmation.artistName}</label>
                <input id="artist-name" name="name" value={editedName} onChange={event => setEditedName(event.target.value)} required className="mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5" />
              </div>
              <div>
                <label htmlFor="artist-country" className="text-sm font-medium">{m.onboarding.country}</label>
                <CountrySelect id="artist-country" name="country_code" countries={countries} defaultValue={countryCode} required />
                {!countryCode && <p className="mt-2 text-sm text-muted-foreground">{m.confirmation.countryMissing}</p>}
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="title" value={artwork.title ?? ''} />
              <input type="hidden" name="country_code" value={countryCode} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
                <dt className="text-muted-foreground">{m.confirmation.artworkTitle}</dt><dd className="break-words font-medium">{artwork.title}</dd>
                <dt className="text-muted-foreground">{m.onboarding.name}</dt><dd className="break-words font-medium">{name}</dd>
                <dt className="text-muted-foreground">{m.onboarding.country}</dt><dd className="font-medium">{countryCodeToName(countryCode, locale)}</dd>
              </dl>
              <button type="button" onClick={() => setEditing(true)} className="mt-2 min-h-11 text-sm font-semibold text-collage-blue underline underline-offset-4">{m.confirmation.fix}</button>
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">{m.onboarding.accountEmail}</p>
          <p className="break-all text-sm font-medium">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{m.confirmation.emailUse}</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{m.confirmation.errors[error] ?? error}</p>}
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
